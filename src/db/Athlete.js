let mongoose = require('mongoose')
//let validator = require('validator')

let athleteSchema = new mongoose.Schema({
    athleteId : { type : String, required: true, unique: true },
    name : { type : String, required: true },
    accessToken : { type : String, required: true, unique: true },
    expiresAt: {type : Number, required: true},
    expiresIn: {type : Number, required: true},
    refreshToken: {type : String, required: true, unique: true }
});

module.exports = mongoose.model('Athlete', athleteSchema, 'Athletes');