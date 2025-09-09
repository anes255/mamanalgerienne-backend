const mongoose = require('mongoose');

// Clear mongoose cache to prevent "model once compiled" errors
function clearMongooseCache() {
  console.log('Clearing mongoose model cache...');
  
  // Delete all cached models
  Object.keys(mongoose.models).forEach(modelName => {
    delete mongoose.models[modelName];
  });
  
  // Delete all cached schemas
  Object.keys(mongoose.modelSchemas).forEach(schemaName => {
    delete mongoose.modelSchemas[schemaName];
  });
  
  console.log('✅ Mongoose cache cleared');
}

// Initialize database connection
async function initializeDatabase() {
  try {
    // Clear cache first
    clearMongooseCache();
    
    // Close existing connection if any
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('Closed existing database connection');
    }
    
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/mama-algerienne', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB successfully');
    
    // Create admin user
    await createAdminUser();
    
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    return false;
  }
}

// Create admin user if doesn't exist
async function createAdminUser() {
  try {
    // Import User model after clearing cache
    const User = require('./models/User');
    
    const existingAdmin = await User.findOne({ 
      email: 'mamanalgeriennepartenariat@gmail.com' 
    });
    
    if (!existingAdmin) {
      const admin = new User({
        name: 'مدير الموقع',
        email: 'mamanalgeriennepartenariat@gmail.com',
        phone: '0555123456',
        password: 'anesaya75',
        isAdmin: true
      });
      
      await admin.save();
      console.log('✅ Admin user created successfully');
    } else {
      // Ensure existing user is admin
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        await existingAdmin.save();
        console.log('✅ Existing user promoted to admin');
      } else {
        console.log('✅ Admin user already exists');
      }
    }
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  }
}

module.exports = { initializeDatabase, clearMongooseCache };