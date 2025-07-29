const mongoose = require("mongoose");

const MetricSchema = new mongoose.Schema({
  name: { type: String, required: true }, 
  goal: { type: Number, required: true }, 
});

const MonthlyGoalSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: false },
  closer: { type: String, default: "all" }, 
  origin: { type: String, default: "all" }, 
  metrics: [MetricSchema],
});


MonthlyGoalSchema.index({ month: 1, closer: 1, origin: 1 }, { unique: true });

module.exports = mongoose.model("MonthlyGoal", MonthlyGoalSchema);