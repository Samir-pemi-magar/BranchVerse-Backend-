const mongoose = require("mongoose");

let gridfsBucket = null;

mongoose.connection.once("open", () => {
    gridfsBucket = new mongoose.mongo.GridFSBucket(
        mongoose.connection.db,
        { bucketName: "covers" }
    );
    console.log("GridFS initialized");
});

module.exports = () => gridfsBucket;
