import Point from '../db/models/point'
import History from '../db/models/history'
import Game from '../db/models/game'
import User from '../db/models/user'

exports.game = async function (req, res) {
	/**
	 * Get /points/game/:id 
	 * @export *
	 * @param { any } req
	 * @param { any } res
	 * @returns { res } All points of a certain game *
	 */
	Points.find({
		game: req.params.id
	}).populate('game').then(function (points) {
		res.send(points);
	}).catch((error) => {
		console.log(error)
		res.status(500).send(error);
	});
}
exports.apply_points = async function (req, res) {
	/**
	 * Post /points/apply
	 * @export *
	 * @param { any } req
	 * @param { any } res
	 * @returns { HttpResponse } Whether the points are applied to the game or not
	 */

	const paaspopMaxPoints = 75;
	const participationPercentage = 10;
	const participationPoints = paaspopMaxPoints / 100 * participationPercentage;
	//set points
	var points = req.body.points;
	var reason = req.body.reason;

	if (!points)
		return res.status(400).send("No points."); //Error: No game is running.
	if (!Array.isArray(points))
		return res.status(405).send("Points are not in array format")
	console.log(points);
	const maxPoints = Math.max.apply(Math, points.map(function (o) {
		return o.points;
	}))

	//Find active game
	var history = await History.findOne({
		gameEnded: null
	}).populate('game').exec();

	if (!history)
		return res.status(409).send("No game is running."); //Error: No game is running.

	if (!reason)
		reason = "Points for game " + history.game.name
	//TODO: Check if input is correctly formatted
	let pointPercentage, fullPoints;
	points.forEach(user => {
		pointPercentage = user.points * 100 / maxPoints;
		fullPoints = Math.ceil(pointPercentage / 100 * paaspopMaxPoints);
		fullPoints += participationPoints;
		user.paaspopPoints = Math.ceil(fullPoints)
	});
	var pointArray = convertToPointObjectArray(history, reason, points)
	console.log(pointArray);

	for (let y = 0; y < pointArray.length; y++) {
		const point = pointArray[y];
		let user = await User.findById(point.user);
		if (!user) {
			pointArray.splice(y, 1);
		} else {
			user.points.push(point._id);
			user.save();
		}
	}
	Point.insertMany(pointArray)
		.then(async function (doc) {
			console.log(pointArray)
			history.points.push.apply(Array.from(pointArray.map(p => p._id)));
			history.users.push.apply(Array.from((pointArray.map(p => p.user))));
			let game = await Game.findOne({
				_id: history.game._id
			});
			game.points.push.apply(Array.from((pointArray.map(p => p._id))));
			history.save();
			game.save();
			res.status(200).send(doc);
		}).catch((error) => {
			console.log(error)
			res.status(500).send(error);
		});
}

function convertToPointObjectArray(history, reason, userPointArray) {
	var output = [];
	let newPoint;
	userPointArray.forEach(el => {
		newPoint = new Point({
			game: history.game._id,
			history: history._id,
			reason: reason,
			points: el.paaspopPoints,
			user: el.user_id
		});
		output.push(newPoint);
	});
	return output;
}