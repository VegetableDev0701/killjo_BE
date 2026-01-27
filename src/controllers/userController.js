const { User } = require('../db');

const toggleFavorite = async (req, res) => {
  const userId = req.user.id;
  let { id, category, type } = req.body;
  console.log('Request data:', { userId, id, category, type });
  
  if (!id || !category || !type) return res.status(400).json({ error: 'Missing id, category or type' });

  const user = await User.findByPk(userId);
  console.log('User found:', { 
    userId: user.id, 
    currentFavorites: user.favorites 
  });
  
  let favorites = user.favorites || [];

  const exists = favorites.some(fav => fav.id === id);
  console.log('Item exists in favorites:', exists);

  if (exists) {
    favorites = favorites.filter(fav => fav.id !== id);
  } else {
    favorites.push({ id, category, type });
  }

  try {
    // Use update instead of save
    await User.update(
      { favorites },
      { where: { id: userId } }
    );

    // Reload user from DB to confirm persistence
    const reloadedUser = await User.findByPk(userId);
    const outputFavorites = reloadedUser.favorites || [];
    console.log('Updated favorites from DB:', outputFavorites);

    res.json({ favorites: outputFavorites });
  } catch (error) {
    console.error('Error saving favorites:', error);
    return res.status(500).json({ error: 'Failed to save favorites' });
  }
};

const getFavorites = async (req, res) => {
  const user = await User.findByPk(req.user.id);
  res.json({ favorites: user.favorites || [] });
};

const updateName = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName } = req.body;

    // Validate input
    if (!firstName || !lastName) {
      return res.status(400).json({ 
        error: 'Both firstName and lastName are required' 
      });
    }

    if (typeof firstName !== 'string' || typeof lastName !== 'string') {
      return res.status(400).json({ 
        error: 'firstName and lastName must be strings' 
      });
    }

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (trimmedFirstName.length === 0 || trimmedLastName.length === 0) {
      return res.status(400).json({ 
        error: 'firstName and lastName cannot be empty' 
      });
    }

    if (trimmedFirstName.length > 50 || trimmedLastName.length > 50) {
      return res.status(400).json({ 
        error: 'firstName and lastName must be 50 characters or less' 
      });
    }

    // Update user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const fullName = `${trimmedFirstName} ${trimmedLastName}`;

    await user.update({
      first_name: trimmedFirstName,
      last_name: trimmedLastName,
      full_name: fullName
    });

    // Return updated values
    res.json({
      message: 'Name updated successfully',
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: user.full_name
    });

  } catch (error) {
    console.error('Error updating name:', error);
    res.status(500).json({ error: 'Failed to update name' });
  }
};

const updateEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (typeof email !== 'string') {
      return res.status(400).json({ error: 'Email must be a string' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if email is already taken by another user
    const existingUser = await User.findOne({
      where: { 
        email: trimmedEmail,
        id: { [require('sequelize').Op.ne]: userId } // Exclude current user
      }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Email is already taken' });
    }

    // Update user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({
      email: trimmedEmail,
      isEmailVerified: false // Reset email verification status
    });

    // Return updated value
    res.json({
      message: 'Email updated successfully',
      email: user.email,
      isEmailVerified: user.isEmailVerified
    });

  } catch (error) {
    console.error('Error updating email:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
};


const updateCountry = async(req, res ) =>{
  try {
    const userId = req.user.id;
    const { country } = req.body;

    // Validate input
    if (!country) {
      return res.status(400).json({ error: 'Country is required' });
    }

    if (typeof country !== 'string') {
      return res.status(400).json({ error: 'Country must be a string' });
    }

    const availableCountryCodes = ["DO", "BR", "PR", "CO", "VE", "MX", "CH", "AE", "US"];

    if (!availableCountryCodes.includes(country)) {
      return res.status(400).json({ error: 'Invalid country code' });
    }

    // Update user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const trimmedCountry = country.trim();
    await user.update({
      metadata: {
        ...user.metadata,
        country: trimmedCountry
      }
    });

    // Return updated value
    res.json({
      message: 'Country updated successfully',
      country: user.metadata.country
    });

  } catch (error) {
    console.error('Error updating country:', error);
    res.status(500).json({ error: 'Failed to update country' });
  }
};


module.exports = {
  toggleFavorite,
  getFavorites,
  updateName,
  updateEmail,
  updateCountry
};