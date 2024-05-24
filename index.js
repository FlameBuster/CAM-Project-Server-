import express from "express";
import bodyParser from "body-parser";
import createError from "http-errors";
import morgan from "morgan";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "node:fs/promises";
import { MongoClient } from "mongodb";

const app = express();
const port = 8080;

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan("dev"));

const uri = "mongodb://localhost:27017/test";
const client = new MongoClient(uri, { useUnifiedTopology: true });
let database;

client
  .connect()
  .then(() => {
    database = client.db("test");
    console.log("Connected to MongoDB");
  })
  .catch((err) => console.error("Error connecting to MongoDB:", err));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

/**
 * This is the main route handler for the root URL ("/") of the server.
 * It sends a welcome message to the client.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 */
app.get("/", (req, res, next) => {
  // Set the status code to 200 and send a welcome message to the client
  res.status(200).send("Welcome to the CME pdf host server");
});

/**
 * POST endpoint for creating a PDF file.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {String} - A success message.
 */
app.post("/pdf/create", upload.single("file"), async (req, res, next) => {
  if (!req.file) {
    return next(createError(400, "No file uploaded"));
  }

  const { originalname, path } = req.file;
  console.log(req.body);
  const id = uuidv4();
  // const metadataObject = JSON.parse(req.body.metadata); // Parse the metadata string
  // const {
  //   materialNo,
  //   Accession_number,
  //   Location,
  //   Page_no,
  //   No_of_copies,
  //   Remarks,
  // } = metadataObject;
  // console.log(materialNo);
  // // Access individual metadata fields
  // const {
  //   Ser_Corps_Inst,
  //   Est_Br,
  //   Sub_Publisher,
  //   Vol,
  //   Year,
  //   Collection_type,
  //   No,
  //   Loc,
  // } = Accession_number;

  const metadata = {
    _id: uuidv4(),
    content_path: path,
    metadata: JSON.parse(req.body.metadata),
  };

  // Upload metadata to MongoDB
  try {
    if (!database) {
      throw new Error("MongoDB connection not established");
    }
    console.log(metadata);
    const collection = database.collection("books1234");
    await collection.insertOne(metadata);
    console.log("Metadata uploaded to MongoDB:", metadata);
  } catch (error) {
    console.error("Error uploading metadata to MongoDB:", error.message);
    return next(createError(500, "Internal Server Error"));
  }

  res.send({ success: true, id });
});

/**
 * PATCH route to edit a PDF document.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {function} next - The next middleware function.
 */
app.patch("/pdf/edit/:id", (req, res, next) => {
  // Your code here
});

/**
 * DELETE route to delete a PDF document.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 */
app.delete("/pdf/delete/:id", async (req, res, next) => {
  const { id } = req.params;

  try {
    if (!database) {
      throw new Error("MongoDB connection not established");
    }

    const collection = database.collection("books");
    const result = await collection.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return next(createError(404, "PDF not found"));
    }

    res.send({ success: true, message: "PDF file deleted successfully" });
  } catch (error) {
    console.error("Error deleting PDF file:", error.message);
    return next(createError(500, "Internal Server Error"));
  }
});

/**
 * Fetches all PDF files metadata.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 */
app.get("/pdf/fetch", async (req, res, next) => {
  try {
    if (!database) {
      throw new Error("MongoDB connection not established");
    }

    const collection = database.collection("books");
    const allMetaData = await collection.find({}).toArray();

    res.json(allMetaData);
  } catch (error) {
    console.error("Error fetching PDF files metadata:", error.message);
    return next(createError(500, "Internal Server Error"));
  }
});

/**
 * Fetches a specific PDF file metadata.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 */
app.get("/pdf/fetch/:id", async (req, res, next) => {
  const { id } = req.params;

  try {
    if (!database) {
      throw new Error("MongoDB connection not established");
    }

    const collection = database.collection("books");
    const metadata = await collection.findOne({ _id: id });

    if (!metadata) {
      return next(createError(404, "PDF not found"));
    }

    res.json(metadata);
  } catch (error) {
    console.error("Error fetching PDF file metadata:", error.message);
    return next(createError(500, "Internal Server Error"));
  }
});

// Middleware to handle 404 errors
app.use("*", (req, res, next) => {
  next(createError(404, "Resource Not Found"));
});

/**
 * Middleware function to handle errors in the Express app.
 * @param {Error} err - The error object.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 */
app.use((err, req, res, next) => {
  /**
   * Create an error object with status and message properties.
   * If the error object does not have a status property, default to 500.
   * If the error object does not have a message property, default to "Internal Server Error".
   */
  const error = {
    status: err.status || 500,
    message: err.message || "Internal Server Error",
  };

  // Set the response status code to the error status or default to 500.
  res.status(err.status || 500).send(error);
});

app.listen(port, () => {
  console.log(`The app is running on port ${port}`);
});
