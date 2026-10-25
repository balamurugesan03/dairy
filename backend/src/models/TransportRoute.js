import mongoose from 'mongoose';

// One stop on the route — a sub centre the van picks milk up from, in pickup order
const routeStopSchema = new mongoose.Schema({
  centre: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CollectionCenter',
    required: true
  },
  centreName: { type: String, trim: true },
  // KM from this stop to the next stop (or to the destination for the last stop)
  km: { type: Number, default: 0, min: 0 }
}, { _id: false });

const transportRouteSchema = new mongoose.Schema({
  routeCode: { type: String, trim: true },
  routeName: {
    type: String,
    required: [true, 'Route name is required'],
    trim: true
  },

  // Vehicle + driver / contractor details
  vehicleNumber: {
    type: String,
    required: [true, 'Van number is required'],
    trim: true,
    uppercase: true
  },
  vehicleType: { type: String, trim: true },
  driverName: { type: String, trim: true },
  driverMobile: { type: String, trim: true },
  ownerName: { type: String, trim: true },
  ownerMobile: { type: String, trim: true },

  // Route: sub centres (in order) → final destination (main centre)
  stops: { type: [routeStopSchema], default: [] },
  destination: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CollectionCenter'
  },
  destinationName: { type: String, trim: true },
  totalKm: { type: Number, default: 0, min: 0 },

  // Pricing: per KM (totalKm × rate per trip) or per Litre (litres carried × rate)
  chargeType: {
    type: String,
    enum: ['KM', 'Litre'],
    required: [true, 'Charge type is required']
  },
  ratePerKm: { type: Number, default: 0, min: 0 },
  ratePerLitre: { type: Number, default: 0, min: 0 },
  shifts: {
    type: [String],
    enum: ['AM', 'PM'],
    default: ['AM', 'PM']
  },
  wefDate: { type: Date, required: [true, 'Date W.E.F is required'] },

  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  remarks: { type: String, trim: true },

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  }
}, { timestamps: true });

transportRouteSchema.pre('save', function () {
  // Total KM is always the sum of stop legs so the two can never disagree
  this.totalKm = Number((this.stops || []).reduce((s, st) => s + (Number(st.km) || 0), 0).toFixed(2));
});

transportRouteSchema.index({ companyId: 1, routeName: 1 });
transportRouteSchema.index({ companyId: 1, vehicleNumber: 1 });

export default mongoose.model('TransportRoute', transportRouteSchema);
