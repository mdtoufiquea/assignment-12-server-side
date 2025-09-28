const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv')
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
dotenv.config();
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json());

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ylskxp9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
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
        scholarship.universityImage = req.file.path;
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
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
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