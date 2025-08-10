const express = require("express");
const fs = require("fs");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
require("dotenv").config();

const contactRoutes = require("./routes/contactRoutes");
const authRoutes = require("./routes/authRoutes");
const { seedAdminUser } = require("./controllers/authController");
const paymentRoutes = require("./routes/paymentRoutes");
const autoUpdateOverdueStatus = require("./utils/cronJobs");
const userRoutes = require("./routes/userRoutes");
const notificationRoutes = require("./routes/notifications");
const trackingRoutes = require("./routes/tracking");
const userPaymentsRoute = require("./routes/userPayments");
const organizerRoutes = require("./routes/organizerRoutes");
const Visitor = require("./models/Visitor");

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: [
    "https://finance-hive.netlify.app", 
    "http://localhost:3000",
    "https://financehive-fh.vercel.app",
    "https://*.vercel.app"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With",
    "Accept"
  ],
  exposedHeaders: ["Content-Type", "Authorization"],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
// Enable pre-flight requests for all routes
app.options('*', cors(corsOptions));

// Body parsers
app.use(bodyParser.json());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("FinanceHive backend is live 🚀");
});

// Request logging for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("MongoDB connected");
    await seedAdminUser(); // Seed admin user
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

// Visitor logic
const getVisitorCount = async () => {
  try {
    let visitor = await Visitor.findOne();
    if (!visitor) {
      visitor = await Visitor.create({ count: 0 });
    }
    return visitor.count;
  } catch (error) {
    console.error("Error getting visitor count:", error);
    return 0;
  }
};

const incrementVisitorCount = async () => {
  try {
    let visitor = await Visitor.findOne();
    if (!visitor) {
      visitor = new Visitor({ count: 1 });
    } else {
      visitor.count += 1;
      visitor.lastUpdated = new Date();
    }
    await visitor.save();
    return visitor.count;
  } catch (error) {
    console.error("Error incrementing visitor count:", error);
    throw error;
  }
};

// API to get and increment visitor count
app.get("/api/visitor-count", async (req, res) => {
  try {
    const count = await getVisitorCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: "Error fetching visitor count" });
  }
});

app.post("/api/increment-visitor", async (req, res) => {
  try {
    const count = await incrementVisitorCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: "Error incrementing visitor count" });
  }
});

// API routes
app.use("/api", contactRoutes);
app.use("/api", authRoutes);
app.use("/api", paymentRoutes);
app.use("/api", userRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api", userPaymentsRoute);
app.use("/api/organizer", organizerRoutes);

// Start cron job
autoUpdateOverdueStatus();

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`404: ${req.method} ${req.path}`);
  res.status(404).json({ message: "Route not found" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
