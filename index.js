const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv')
const path = require("path");
const { ObjectId } = require("mongodb");
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
dotenv.config();
const port = process.env.PORT || 5000;

app.use(cors())

app.use(express.json());

const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 
  }
});

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ylskxp9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const db = client.db('ScholarX');
    const usersCollection = db.collection('users');
    const scholarshipCollection = db.collection("scholarships");

    app.post("/users", async (req, res) => {
      const user = req.body;
      const find_result = await usersCollection.findOne({ email: user.email })

      if (find_result) {
        res.send({ msg: "user already exist" });
      } else {
        const result = await usersCollection.insertOne(user);
        res.send(result);
      }
    });

    app.post("/scholarships", upload.single("universityImage"), async (req, res) => {
      try {
        const scholarship = req.body;
        console.log("Scholarship data:", scholarship);
        console.log("File data:", req.file);

        scholarship.universityImage = req.file ? req.file.path : null;
        const result = await scholarshipCollection.insertOne(scholarship);
        res.send({ success: true, message: "Scholarship added successfully", result });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send(user);
    });

    app.get("/scholarships", async (req, res) => {
      try {
        const scholarships = await scholarshipCollection.find().toArray();
        res.send({ success: true, data: scholarships });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: err.message });
      }
    });

    app.get("/scholarships/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const scholarship = await scholarshipCollection.findOne({ _id: new ObjectId(id) });

        if (!scholarship) {
          return res.status(404).json({ message: "Scholarship not found" });
        }

        res.json({ data: scholarship });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.put("/scholarships/:id", upload.single("universityImage"), async (req, res) => {
      try {
        const id = req.params.id;
        console.log(" PUT Request received for ID:", id);
        console.log(" File received:", req.file ? req.file.filename : "No file");
        console.log(" Body data keys:", Object.keys(req.body));

        
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid ID format"
          });
        }

        const objectId = new ObjectId(id);

        
        const existingDoc = await scholarshipCollection.findOne({ _id: objectId });
        if (!existingDoc) {
          return res.status(404).json({
            success: false,
            message: `Scholarship with ID ${id} not found`
          });
        }


        const textFields = [
          'scholarshipName', 'universityName', 'country', 'city',
          'subjectCategory', 'scholarshipCategory', 'degree', 'email'
        ];

        textFields.forEach(field => {
          if (req.body[field] !== undefined) {
            updateData[field] = req.body[field];
          }
        });

        const numberFields = ['worldRank', 'tuitionFees', 'applicationFees', 'serviceCharge'];
        numberFields.forEach(field => {
          if (req.body[field] !== undefined) {
            updateData[field] = Number(req.body[field]);
          }
        });

        if (req.body.deadline) updateData.deadline = new Date(req.body.deadline);
        if (req.body.postDate) updateData.postDate = new Date(req.body.postDate);

        if (req.file) {
          updateData.universityImage = req.file.path;
          console.log(" Image updated to:", req.file.path);
        }

        console.log("Fields to update:", Object.keys(updateData));

        const result = await scholarshipCollection.findOneAndUpdate(
          { _id: objectId },
          { $set: updateData },
          { returnDocument: "after" }
        );

        console.log(" Update successful");

        res.json({
          success: true,
          message: "Scholarship updated successfully",
          data: result.value
        });

      } catch (err) {
        console.error("PUT ERROR:", err);
        res.status(500).json({
          success: false,
          message: "Server error: " + err.message
        });
      }
    });
    app.delete("/scholarships/:id", async (req, res) => {
      const { id } = req.params;

      try {
        const result = await scholarshipCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Scholarship not found"
          });
        }

        res.json({
          success: true,
          message: "Scholarship deleted successfully",
          result
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          message: err.message
        });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

app.listen(port, () => {
  console.log(`Server is running on port :${port}`);
});