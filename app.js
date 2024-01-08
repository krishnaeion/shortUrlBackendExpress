const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;
const crypto = require('crypto');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Krishna1999@@localhost:5432/postgres';

const client = new Client({
  connectionString: connectionString,
});

app.use(cors()); 
app.use(bodyParser.json());


const handleDatabaseErrors = (err, res) => {
  console.error('Error during database operation:', err);
  res.status(500).json({ message: 'Internal Server Error' });
};


client.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Error connecting to PostgreSQL', err));


process.on('SIGINT', () => {
  client.end()
    .then(() => console.log('Disconnected from PostgreSQL'))
    .catch(err => console.error('Error disconnecting from PostgreSQL', err))
    .finally(() => process.exit(0));
});
function encryptPassword(password) {
  const hash = crypto.createHash('sha256'); 
  hash.update(password);
  return hash.digest('hex');
}
function verifyPassword(inputPassword, hashedPassword) {
  const inputHash = encryptPassword(inputPassword);
  console.log(inputHash);
  return inputHash === hashedPassword;
}
// Login endpoint
app.post('/login', async (req, res) => {
  const { userName, password } = req.body;

  try {
    // Check if the user exists
    const userQuery = await client.query('SELECT * FROM users WHERE user_name = $1', [userName]);

    if (userQuery.rows.length === 0) {
      res.status(401).json({ message: 'Invalid username' });
      return;
    }
console.log(password)
console.log(userQuery.rows[0].password)
    // Compare the hashed password
    const passwordMatch = await verifyPassword(password,userQuery.rows[0].password);

    if (!passwordMatch) {
      res.status(401).json({ message: 'Invalid username or password' });
      return;
    }

    // Authentication successful
    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    handleDatabaseErrors(error, res);
  }
});

// Registration endpoint
app.post('/register', async (req, res) => {
  const { userName, password, fullName, email, mobileNumber } = req.body;

  try {
    const hashedPassword = await encryptPassword(password);

    const result = await client.query(
      'INSERT INTO users (user_name, password, full_name, email_id, number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userName, hashedPassword, fullName, email, mobileNumber]
    );

    const newUser = result.rows[0];
    res.status(201).json({
      id: newUser.id,
      user_name: newUser.user_name,
    });
  } catch (error) {
    handleDatabaseErrors(error, res);
  }
});

// Shorten URL endpoint
app.post('/shorten', async (req, res) => {
  const { originalUrl } = req.body;

  // Generate a short ID using uuid
  const shortId = uuidv4();

  try {
    // Insert the URL into the database
    const result = await client.query(
      'INSERT INTO short_url (short_url, original_url, created_time) VALUES ($1, $2, $3) RETURNING short_url',
      [shortId, originalUrl, new Date()]
    );

    res.json({ shortUrl: `${req.protocol}://${req.get('host')}/${result.rows[0].short_url}`, shortId: result.rows[0].short_url });
  } catch (error) {
    handleDatabaseErrors(error, res);
  }
});


app.get('/getShortUrl/:shortId', async (req, res) => {
  const { shortId } = req.params;

  try {
    
    const result = await client.query('SELECT * FROM short_url WHERE short_url = $1', [shortId]);

    if (result.rows.length > 0) {
      const url = result.rows[0];

     
      const createdAt = moment(url.created_time);
      const now = moment();
      const validityDuration = moment.duration(now.diff(createdAt)).asHours();

      if (validityDuration <= 48) {
       
        res.status(200).json({originalUrl:url.original_url});
      } else {
        // URL has expired
        res.status(410).json({ error: 'URL has expired' });
      }
    } else {
      // Short URL not found
      res.status(404).json({ error: 'Short URL not found' });
    }
  } catch (error) {
    handleDatabaseErrors(error, res);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
