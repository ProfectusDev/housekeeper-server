// Server Build 0.1.0
// @Author Arjun Chib
// @Author John Fiorentino
// Contact them for Questions

var express = require('express');
var mysql      = require('mysql');
var jwt = require('jsonwebtoken');
var bodyParser = require('body-parser');

var app = express();

var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'jdcogsquad',
  database : 'Housekeeper'
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var secret = process.env.JWT_SECRET;

// Create new user and add to the database
app.post('/createUser', function(req, res) {
  var email = req.body['email'];
  var password = req.body.['password'];
  var query_str = "INSERT INTO Users (email, password) VALUES ('" + email + "', '" + password + "');"
  connection.query(query_str, function (error, results, fields) {
    if (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(500).send('This email is already in use.');
        console.log('Email already used: ' + email);
      } else {
        res.status(500).send('Error: ' + error.code);
        console.log('Error: ' + error.code);
      }
    } else {
      res.send('Successfully Added User');
      console.log('Added user with email: ' + email);
    }
  });
})

// Login a user and create a session token
app.post('/createSession', function(req, res) {
  var email = req.body['email'];
  var password = req.body['password'];
  var query_str = "SELECT id, password FROM Users WHERE (email = '" + email + "');"
  connection.query(query_str, function (error, results, fields) {
    if (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(500).send('This email is already in use.');
        console.log('Email already used: ' + email);
      } else {
        res.status(500).send('Error: ' + error.code);
        console.log('Error: ' + error.code);
      }
    } else if (results.length === 0) {
      res.status(500).send('This email has not been registered.');
    } else if (results[0]['password'] === password) {
      var token = jwt.sign({id: results[0]['id']}, secret);
      res.send(token);
      console.log('Logged in user with email: ' + email);
    } else {
      res.status(500).send('Email and password do not match.');
    }
  });
})

// add a House object to the user profile
app.post('/addHouse', function(req, res) {
  var token = req.body['token'];
  try {
    var decoded = jwt.verify(token, secret);
  } catch(err) {
    console.log('Invalid token attempted.');
    return
  }

  console.log(decoded);

  // User Information
  // var user_id = req.query.user_id;

  // House Information
  var address = req.query.address;

  // var location = req.query.location;
  var image = req.query.image;

  // var categories = req.query.categories;

  // execute query
  var query_str = "INSERT INTO Houses (hid, address) VALUES('" + user_id + "', '" + address + "');"
  connection.query(query_str, function (error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else {
      res.send('Successfully Added House!');
      res.send('Successfully Added House');
      console.log('Added House with address: ' + address);
    }
  });
})

// Remove house from the user's house-list
app.delete('/deleteHouse', function(req, res) {
  var user_id = req.query.user_id;
  var house_id = req.query.user_id;
  var query_str = "DELETE FROM Houses WHERE (house_id = '" + house_id + "');"
  connection.query(query_str, function(error, results, fields){
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else {
      res.send('Successfully Removed House');
      console.console.log('Removed House from List: ' + house_id);
    }
  });
})


// Logout a user and mark their session token as 'inactive'
app.delete('/logout', function(req,res) {
  //code
})

// Remove user from the database
app.delete('/deleteUser', function (req, res) {
  var user_id = req.query.user_id;
  var query_str = "DELETE FROM Users WHERE (user_id = '" + user_id + "');"
  connection.query(query_str, function(error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else {
      res.send('Successfully Removed User');
      console.log('Removed User from the HouseKeeper Database: ' + user_id);
    }
  });
});


connection.connect();
app.listen(8081, function() {
    console.log('Server ready');
});
