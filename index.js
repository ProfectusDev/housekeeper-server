// Server Build 0.1.0
// @Author Arjun Chib
// @Author John Fiorentino
// Contact them for Questions

var express = require('express');
var app = express();

var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'jdcogsquad',
  database : 'Housekeeper'
});

// Remove user from the database
app.delete('/deleteUser', function (req, res) {
  //code
})

// Create new user and add to the database
app.get('/createUser', function(req, res) {
  var email = req.query.email;
  var password = req.query.password;
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
app.get('/createSession', function(req, res) {
  var email = req.query.email;
  var password = req.query.password;
  var query_str = "SELECT password FROM Users WHERE (email = '" + email + "');"
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
      res.send('Logged in.');
      console.log('Logged in user with email: ' + email);
    } else {
      res.status(500).send('Email and password do not match.');
    }
  });
})

connection.connect();
app.listen(8081, function() {
    console.log('Server ready');
});
