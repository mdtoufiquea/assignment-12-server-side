const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv')
const path = require("path");
const { ObjectId } = require("mongodb");
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
dotenv.config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    const appliedScholarshipCollection = db.collection("appliedScholarships");
    const reviewsCollection = db.collection("reviews");


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



    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { amount } = req.body;
        if (!amount) {
          return res.status(400).send({ error: "Amount is required" });
        }

        const paymentIntent = await stripe.paymentIntents.create({
          amount: parseInt(amount * 100),
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: err.message });
      }
    });



    app.post("/apply-scholarship", async (req, res) => {
      try {
        const application = req.body;
        const result = await appliedScholarshipCollection.insertOne(application);

        res.send({ success: true, data: result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: err.message });
      }
    });


    app.post("/applied-scholarships/:id/feedback", async (req, res) => {
      const { feedback } = req.body;
      try {
        const result = await appliedScholarshipCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { feedback } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ success: false, message: "Application not found" });
        }
        res.json({ success: true, message: "Feedback submitted successfully" });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });



    app.post("/reviews", async (req, res) => {
      const review = req.body;
      try {
        // universityId যোগ করুন
        const reviewWithDate = {
          ...review,
          universityId: review.universityId || review.scholarshipId, // দুটোর মধ্যে যেকোনো একটি
          reviewDate: new Date()
        };

        const result = await reviewsCollection.insertOne(reviewWithDate);
        res.send({ success: true, message: "Review submitted successfully", data: result });
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




    app.get("/applied-scholarships", async (req, res) => {
      try {
        const result = await appliedScholarshipCollection.find().toArray();
        res.send({ success: true, data: result });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });



    app.get("/applied-scholarships/user/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const result = await appliedScholarshipCollection.find({ userEmail: email }).toArray();
        res.send({ success: true, data: result });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });




    app.get("/reviews/scholarship/:id", async (req, res) => {
      try {
        const { id } = req.params;

        // ObjectId validation
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ success: false, message: "Invalid scholarship ID" });
        }

        const reviews = await reviewsCollection.find({
          universityId: id
        }).toArray();

        res.send({ success: true, data: reviews });
      } catch (err) {
        console.error("Error fetching reviews:", err);
        res.status(500).send({ success: false, message: err.message });
      }
    });


    app.get("/reviews", async (req, res) => {
      try {
        const reviews = await reviewsCollection.find().toArray();
        res.json({ success: true, data: reviews });
      } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch reviews" });
      }
    });


    app.get("/reviews/:email", async (req, res) => {
      const email = req.params.email;
      const result = await reviewsCollection.find({ userEmail: email }).toArray();
      res.send({ success: true, data: result });
    });



    
    app.get("/top-scholarships", async (req, res) => {
      try {
        const scholarships = await scholarshipCollection
          .find({})
          .sort({ applicationFee: 1, postedDate: -1 }) 
          .limit(6) 
          .toArray();

        res.send(scholarships);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch top scholarships" });
      }
    });







    app.put("/scholarships/:id", upload.single("universityImage"), async (req, res) => {
      try {
        const id = req.params.id;
        console.log(" PUT Request received for ID:", id);

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

        const updateData = { ...req.body };

        Object.keys(updateData).forEach(key => {
          if (updateData[key] === '' || updateData[key] === undefined) {
            delete updateData[key];
          }
        });

        if (updateData.worldRank) updateData.worldRank = Number(updateData.worldRank);
        if (updateData.tuitionFees) updateData.tuitionFees = Number(updateData.tuitionFees);
        if (updateData.applicationFees) updateData.applicationFees = Number(updateData.applicationFees);
        if (updateData.serviceCharge) updateData.serviceCharge = Number(updateData.serviceCharge);

        if (updateData.deadline) updateData.deadline = new Date(updateData.deadline);
        if (updateData.postDate) updateData.postDate = new Date(updateData.postDate);

        if (req.file) {
          updateData.universityImage = req.file.path;
        }

        console.log(" Updating with data:", updateData);

        const result = await scholarshipCollection.findOneAndUpdate(
          { _id: objectId },
          { $set: updateData },
          { returnDocument: "after" }
        );

        res.json({
          success: true,
          message: "Scholarship updated successfully",
          data: result.value
        });

      } catch (err) {
        console.error(" PUT ERROR:", err);
        res.status(500).json({
          success: false,
          message: "Server error: " + err.message
        });
      }
    });



    app.put("/applied-scholarships/:id/status", async (req, res) => {
      const { status } = req.body;
      try {
        const result = await appliedScholarshipCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { status } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ success: false, message: "Application not found" });
        }
        res.json({ success: true, message: "Application status updated" });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });



    app.put("/applied-scholarships/:id", async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;
      try {
        const existing = await appliedScholarshipCollection.findOne({ _id: new ObjectId(id) });
        if (!existing) return res.status(404).send({ success: false, message: "Application not found" });
        if (existing.status !== "pending") return res.status(400).send({ success: false, message: "Cannot edit processed application" });

        const result = await appliedScholarshipCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        res.send({ success: true, message: "Application updated successfully" });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });


    app.put("/reviews/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updateDoc = {
          $set: {
            rating: req.body.rating,
            comment: req.body.comment,
          },
        };

        const result = await reviewsCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );

        if (result.modifiedCount > 0) {
          res.send({ success: true, modifiedCount: result.modifiedCount });
        } else {
          res.send({ success: false, modifiedCount: 0 });
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, error: err.message });
      }
    });




    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );

      res.json(result);
    });


    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
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


    app.delete("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const result = await reviewsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send({ success: true, deletedCount: result.deletedCount });
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