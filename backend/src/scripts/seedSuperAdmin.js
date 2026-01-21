import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const superAdminData = {
  username: 'superadmin',
  password: 'Admin@123',
  displayName: 'Super Admin',
  role: 'superadmin',
  status: 'active'
};

async function seedSuperAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    // Check if superadmin already exists
    const existingAdmin = await User.findOne({ username: superAdminData.username });

    if (existingAdmin) {
      console.log('✓ Super Admin user already exists');
      console.log('  Username:', existingAdmin.username);
      console.log('  Role:', existingAdmin.role);
      console.log('  Status:', existingAdmin.status);
    } else {
      // Create superadmin user
      const superAdmin = await User.create(superAdminData);
      console.log('✓ Super Admin user created successfully!');
      console.log('  Username:', superAdmin.username);
      console.log('  Password:', 'Admin@123 (Please change after first login)');
      console.log('  Role:', superAdmin.role);
    }

    console.log('\n✓ Super Admin seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding Super Admin:', error);
    process.exit(1);
  }
}

seedSuperAdmin();
