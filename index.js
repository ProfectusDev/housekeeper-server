// Server Build 0.1.0
// @Author Arjun Chib
// @Author John Fiorentino
// Contact them for Questions

var express = require('express');
var mysql = require('mysql');
var jwt = require('jsonwebtoken');
var bodyParser = require('body-parser');

var app = express();

// var connection = mysql.createConnection({
//   host     : 'localhost',
//   user     : 'root',
//   password : 'jdcogsquad',
//   database : 'Housekeeper'
// });

var db_config = {
  host     : 'localhost',
  user     : 'root',
  password : 'jdcogsquad',
  database : 'Housekeeper'
};

var connection;

function handleDisconnect() {
  connection = mysql.createConnection(db_config);

  // connection.connect(function(err) {
  //   console.log(err);
  //   if (err) {
  //     console.log('Error when connecting to database:', err);
  //     setTimeout(handleDisconnect, 2000);
  //   }
  // });

  connection.on('error', function(err) {
    console.log('Database error:', err.code);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log("handle disconnect");
      handleDisconnect();
    } else {
      throw err;
    }
  });
}

handleDisconnect();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var secret = process.env.JWT_SECRET;

function decodeToken(authHeader) {
  var token = ''
  if (authHeader != null && authHeader.length > 7) {
    token = authHeader.substr(7);
  }
  try {
    var decoded = jwt.verify(token, secret);
    return decoded;
  } catch(err) {
    console.log('Invalid token attempted.');
    return null;
  }
}

// Create new user and add to the database
app.post('/api/register', function(req, res) {
  var email = req.body['email'];
  var password = req.body['password'];
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
      console.log('Added user with email: ' + email);
      query_str = "SELECT LAST_INSERT_ID();"
      connection.query(query_str, function (error, results, fields) {
        var id = results[0]['LAST_INSERT_ID()'];
        var token = jwt.sign({
          user_id: id
        }, secret, {expiresIn: '1h'});
        res.send({'token': token});
      });
    }
  });
});

// Login a user and create a session token
app.post('/api/login', function(req, res) {
  var email = req.body['email'];
  var password = req.body['password'];
  var query_str = "SELECT id, password FROM Users WHERE (email = '" + email + "');"
  connection.query(query_str, function (error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else if (results.length === 0) {
      res.status(500).send('This email has not been registered.');
    } else if (results[0]['password'] === password) {
      var id = results[0]['id'];
      var token = jwt.sign({
        user_id: id
      }, secret, {expiresIn: '1h'});
      res.send({'token' : token});
      console.log('Logged in user with email: ' + email);
    } else {
      res.status(500).send('Email and password do not match.');
    }
  });
})

// add a House object to the user profile
app.post('/api/addHouse', function(req, res) {
  var authHeader = req.headers.authorization;
  var claims = decodeToken(authHeader);
  if (claims === null) {
    res.status(403).send('Forbidden.');
    return;
  }

  var address = req.body['address'];
  var user_id = claims['user_id'];

  var query_str = "INSERT INTO Houses (address) VALUES('" + address + "');";
  connection.query(query_str, function (error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else {
      query_str = "SELECT LAST_INSERT_ID();"
      connection.query(query_str, function (error, results, fields) {
        if (error) {
          res.status(500).send('Error: ' + error.code);
          console.log('Error: ' + error.code);
        } else {
          var hid = results[0]['LAST_INSERT_ID()'];
          query_str = "INSERT INTO UserHouseRelationship (id, hid) VALUES('" + user_id + "','" + hid + "');";
          connection.query(query_str, function (error, results, fields) {
            if (error) {
              res.status(500).send('Error: ' + error.code);
              console.log('Error: ' + error.code);
            } else {
              res.send('House added.');
              console.log('Added House with address: ' + address);
            }
          });
        }
      });
    }
  });
});

app.get('/api/getHouses' , function(req, res) {
  var authHeader = req.headers.authorization;
  var claims = decodeToken(authHeader);
  if (claims === null) {
    res.status(403).send('Forbidden.');
    return;
  }

  var user_id = claims['user_id'];

  var query_str = "SELECT * FROM UserHouseRelationship WHERE (id = '" + user_id + "');";
  connection.query(query_str, function (error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else if (results.length == 0) {
      res.send([]);
    } else {
      var hid = results[0]['hid'];
      query_str = "SELECT * FROM Houses WHERE hid IN(";
      for (var i = 0; i < results.length; i++) {
        var hid = results[i]['hid'];
        query_str += ("'" + hid + "',");
      }
      query_str = query_str.substr(0, query_str.length - 1) + ");";
      connection.query(query_str, function (error, results, fields) {
        if (error) {
          res.status(500).send('Error: ' + error.code);
          console.log('Error: ' + error.code);
        } else {
          res.send(results);
        }
      });
    }
  });
});

// Remove house from the user's house-list
app.post('/api/deleteHouse', function(req, res) {
  var authHeader = req.headers.authorization;
  var claims = decodeToken(authHeader);
  if (claims === null) {
    res.status(403).send('Forbidden');
    return;
  }

  var user_id = claims['user_id'];
  var house_id = req.body["hid"];

  // var query_str = "DELETE FROM Houses WHERE (hid = '" + house_id + "');";
  var query_str = "DELETE FROM UserHouseRelationship WHERE (id = " + user_id + " AND hid = " + house_id + ");"
  connection.query(query_str, function(error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else {
      if (results["affectedRows"] > 0) {
        var query_str = "DELETE FROM Houses WHERE (hid = '" + house_id + "');";
        connection.query(query_str, function(error, results, fields) {
          if (error) {
            res.status(500).send('Error: ' + error.code);
            console.log('Error: ' + error.code);
          } else {
            res.send('Successfully removed house.');
            console.log('Removed house with id: ' + house_id);
          }
        });
      } else {
        res.status(500).send('Invalid hid.');
        console.log('Could not remove house with id: ' + house_id);
      }
    }
  });
})


// Logout a user and mark their session token as 'inactive'
app.post('/api/logout', function(req,res) {
  //code
})


// Remove user from the database
app.post('/api/deleteUser', function (req, res) {
  var user_id = req.body["id"];
  var query_str = "DELETE FROM Users WHERE (id = '" + user_id + "');"
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
