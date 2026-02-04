import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Define all modules in the system
const MODULES = [
  'dashboard',
  'farmers',
  'customers',
  'suppliers',
  'sales',
  'purchases',
  'milkCollection',
  'payments',
  'inventory',
  'accounting',
  'reports',
  'hrm',
  'settings',
  'collectionCenters',
  'subsidies'
];

// Permission schema for each module
const permissionSchema = new mongoose.Schema({
  module: {
    type: String,
    enum: MODULES,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  write: {
    type: Boolean,
    default: false
  },
  edit: {
    type: Boolean,
    default: false
  },
  delete: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  displayName: {
    type: String,
    trim: true
  },
  userType: {
    type: String,
    enum: ['auditor', 'dairy_department', 'society', 'milma', 'president', 'superuser', 'admin', 'ordinary'],
    default: 'ordinary'
  },
  designation: {
    type: String,
    enum: [
      'Secretary',
      'Assistant Secretary',
      'Attender',
      'Auditor',
      'Branch Supervisor',
      'Cleaner',
      'Dairy Department',
      'Data Entry Operator',
      'Junior Clerk',
      'Officer',
      'Lab Assistant',
      'Lab Technician',
      'Milma',
      'Peon',
      'Plant Operator',
      'President',
      'Procurement Assistant',
      'Sales Man',
      'Senior Clerk',
      'System Administrator',
      'Technical Supervisor',
      'Other'
    ],
    default: 'Other'
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'user'],
    default: 'user'
  },
  joiningDate: {
    type: Date
  },
  expireDate: {
    type: Date
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  // Module-wise permissions
  permissions: [permissionSchema],
  // Phone number for contact
  phone: {
    type: String,
    trim: true
  },
  // Email for contact
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  passwordChangedAt: Date,
  lastLogin: Date
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ company: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ designation: 1 });

// Pre-save hook to hash password
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;

  // Hash password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Update passwordChangedAt for existing documents
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000;
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check if password changed after token was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Instance method to check if user has permission for a module action
userSchema.methods.hasPermission = function(moduleName, action) {
  // Superadmin and admin have all permissions
  if (this.role === 'superadmin' || this.role === 'admin') {
    return true;
  }

  const modulePermission = this.permissions.find(p => p.module === moduleName);
  if (!modulePermission) {
    return false;
  }

  return modulePermission[action] === true;
};

// Instance method to get all permissions as object
userSchema.methods.getPermissionsObject = function() {
  const permObj = {};
  this.permissions.forEach(p => {
    permObj[p.module] = {
      read: p.read,
      write: p.write,
      edit: p.edit,
      delete: p.delete
    };
  });
  return permObj;
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

// Static method to get all module names
userSchema.statics.getModules = function() {
  return MODULES;
};

// Static method to create default permissions (all false)
userSchema.statics.getDefaultPermissions = function() {
  return MODULES.map(module => ({
    module,
    read: false,
    write: false,
    edit: false,
    delete: false
  }));
};

// Static method to create full permissions (all true)
userSchema.statics.getFullPermissions = function() {
  return MODULES.map(module => ({
    module,
    read: true,
    write: true,
    edit: true,
    delete: true
  }));
};

const User = mongoose.model('User', userSchema);

export default User;
