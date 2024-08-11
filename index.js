const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://friday-school.web.app",
      "https://friday-school.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Friday school server is here!!");
});

// authentication
app.post("/jwt", async (req, res) => {
  const email = req.body;
  const token = jwt.sign(email, process.env.JWT_SECRET, { expiresIn: "1h" });
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    })
    .send({ success: true });
});

app.get("/logout", (req, res) => {
  res
    .clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 0,
    })
    .send({ success: true });
});

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res
      .status(401)
      .send({ message: "Unauthenticated!", success: false });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, data) => {
    if (err) {
      return res
        .status(401)
        .send({ message: "Unauthenticated!", success: false });
    }
    req.user = data;
    next();
  });
};

const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.cxk7yn6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const AssignmentCollection = client
      .db("FridaySchool")
      .collection("assigments");
    const SubmissionCollection = client
      .db("FridaySchool")
      .collection("submissions");

    // Assignments services apis
    app.get("/assignments", async (req, res) => {
      const query = req.query || {};
      const cursor = AssignmentCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/assignments/:id", async (req, res) => {
      const id = req.params.id;
      const result = await AssignmentCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    app.post("/assignments", async (req, res) => {
      const reqBody = req.body;
      const result = await AssignmentCollection.insertOne(reqBody);
      res.send(result);
    });
    app.patch("/assignments/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const reqBody = req.body;
      if (req.user.email !== reqBody.user_email) {
        return res.status(403).send({ message: "Forbidden", success: false });
      }
      const filter = { _id: new ObjectId(id) };
      const updateAssignment = {
        $set: { ...reqBody },
      };
      const result = await AssignmentCollection.updateOne(
        filter,
        updateAssignment
      );
      res.send(result);
    });
    app.delete("/assignments/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const Assignment = await AssignmentCollection.findOne({
        _id: new ObjectId(id),
      });
      if (req.user.email !== Assignment.user_email) {
        return res.status(403).send({ message: "Forbidden", success: false });
      }
      const result = await AssignmentCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Assign submission related api's
    app.post("/assignment-submition", verifyToken, async (req, res) => {
      const reqBody = req.body;
      if (req.user.email !== reqBody.student_email) {
        return res.status(403).send({ message: "Forbidden", success: false });
      }
      const result = await SubmissionCollection.insertOne(reqBody);
      res.send(result);
    });
    app.get(
      "/my-submited-assignments/:email",
      verifyToken,
      async (req, res) => {
        const email = req.params.email;
        if (req.user.email !== email) {
          return res.status(403).send({ message: "Forbidden", success: false });
        }
        const cursor = SubmissionCollection.find({ student_email: email });
        const result = await cursor.toArray();
        res.send(result);
      }
    );
    app.get("/my-pending-assignments/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.user.email !== email) {
        return res.status(403).send({ message: "Forbidden", success: false });
      }
      const cursor = SubmissionCollection.find({
        user_email: email,
        status: "pending",
      });
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/submissions/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const Submission = await SubmissionCollection.findOne({
        _id: new ObjectId(id),
      });
      if (req.user.email !== Submission.user_email) {
        return res.status(403).send({ message: "Forbidden", success: false });
      }
      const result = await SubmissionCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.patch("/submissions/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const Submission = await SubmissionCollection.findOne({
        _id: new ObjectId(id),
      });
      if (req.user.email !== Submission.user_email) {
        return res.status(403).send({ message: "Forbidden", success: false });
      }
      const reqBody = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateAssignment = {
        $set: { ...reqBody },
      };
      const result = await SubmissionCollection.updateOne(
        filter,
        updateAssignment
      );
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
