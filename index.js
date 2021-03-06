// Server Build 0.1.0
// @Author Arjun Chib
// @Author John Fiorentino
// Contact them for Questions

var express = require('express');
var mysql = require('mysql');
var jwt = require('jsonwebtoken');
var bodyParser = require('body-parser');

var app = express();

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
    console.log("Invalid token attempted.");
    return null;
  }
}

function checkClaims(claims) {
  return (claims !== null && "uid" in claims)
}

// Create new user and add to the database
app.post('/api/register', function(req, res) {
  var email = req.body['email'];
  var password = req.body['password'];
  connection.query('INSERT INTO Users (email, password) VALUES (?, ?)', [email,password], function (error, results, fields) {
    if (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(500).send('This email is already in use.');
        console.log('Email already used: ' + email);
      } else {
        res.status(500).send('Error: ' + error.code);
        console.log('Error: ' + error.code);
      }
    } else {
      var uid = results.insertId;
      var address = 'Dream House'
      connection.query('INSERT INTO Houses (address) VALUES(?)', address, function (error, results, fields) {
        if (error) {
          res.status(500).send('Error: ' + error.code);
          console.log('Error: ' + error.code);
        } else {
          var dhid = results.insertId;
          connection.query('UPDATE Users SET `dream hid` = ? WHERE (id = ?)', [dhid, uid], function (error, results, fields) {
            if (error) {
              res.status(500).send('Error: ' + error.code);
              console.log('Error: ' + error.code);
            } else {
              connection.query('INSERT INTO UserHouseRelationship (id, hid, isDreamHouse) VALUES(?, ?, 1)', [uid, dhid],
              function (error, results, fields) {
                if (error) {
                  res.status(500).send('Error: ' + error.code);
                  console.log('Error: ' + error.code);
                } else {
                  console.log('Added user with id: ' + uid);
                  var token = jwt.sign({uid: uid}, secret, {expiresIn: '1h'});
                  res.send({'token': token});
                }
              });
            }
          });
        }
      });
    }
  });
});

// Login a user and create a session token
app.post('/api/login', function(req, res) {
  var email = req.body['email'];
  var password = req.body['password'];
  connection.query('SELECT id, password FROM Users WHERE (email = ?)', email, function (error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else if (results.length === 0) {
      res.status(500).send('This email has not been registered.');
      console.log('Invalid login attempt.');
    } else if (results[0]['password'] === password) {
      var uid = results[0]['id'];
      var token = jwt.sign({
        uid: uid
      }, secret, {expiresIn: '1h'});
      res.send({'token' : token});
      console.log('Logged in user with id: ' + uid);
    } else {
      res.status(500).send('Email and password do not match.');
      console.log('Invalid login attempt.');
    }
  });
})

// Add a House object to the user profile
app.post('/api/addHouse', function(req, res) {
  var authHeader = req.headers.authorization;
  var claims = decodeToken(authHeader);
  if (!checkClaims(claims)) {
    res.status(403).send('Forbidden.');
    return;
  }

  var address = req.body['address'];
  var uid = claims['uid'];

  connection.query('INSERT INTO Houses (address) VALUES(?)', address,
  function (error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else {
      var hid = results.insertId;
      connection.query('INSERT INTO UserHouseRelationship (id, hid) VALUES(?, ?)', [uid, hid],
      function (error, results, fields) {
        if (error) {
          res.status(500).send('Error: ' + error.code);
          console.log('Error: ' + error.code);
        } else {
          res.send({'hid': hid});
          console.log('Added House with id: ' + hid);
        }
      });
    }
  });
});

// Get a list of houses of a user
app.get('/api/getHouses' , function(req, res) {
  var authHeader = req.headers.authorization;
  var claims = decodeToken(authHeader);
  if (claims === null) {
    res.status(403).send('Forbidden.');
    return;
  }

  var uid = claims['uid'];

  connection.query('SELECT * FROM UserHouseRelationship WHERE (id = ? and isDreamHouse = 0)', uid,
  function (error, results, fields) {
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
      connection.query(query_str,
        function (error, results, fields) {
        if (error) {
          res.status(500).send('Error: ' + error.code);
          console.log('Error: ' + error.code);
        } else {
          res.send(results);
          console.log('Sent houses to user: ' + uid);
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

  var uid = claims['uid'];
  var hid = req.body['hid'];

  var query_str = ";"
  connection.query('DELETE FROM UserHouseRelationship WHERE (id = ? AND hid = ?)', [uid, hid], function(error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else {
      if (results.affectedRows > 0) {
        connection.query('DELETE FROM Houses WHERE (hid = ?)', hid, function(error, results, fields) {
          if (error) {
            res.status(500).send('Error: ' + error.code);
            console.log('Error: ' + error.code);
          } else {
            res.send('Successfully removed house.');
            console.log('Removed house with id: ' + hid);
          }
        });
      } else {
        res.status(500).send('Invalid hid.');
        console.log('Could not remove house with id: ' + hid);
      }
    }
  });
})

// Method to retrieve the Dream House Template
// @author John Fiorentino
app.get('/api/getDreamHouse', function(req, res) {
  var authHeader = req.headers.authorization;
  var claims = decodeToken(authHeader);
  if (claims === null) {
    res.status(403).send('Forbidden');
    return;
  }

  var uid = claims['uid'];

  connection.query('SELECT * FROM Users WHERE (id = ?)', uid,
  function(error, results, fields){
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else {
      var dhid = results[0]['dream hid'];
      connection.query('SELECT * FROM Houses WHERE (hid = ?)', dhid,
      function(error, results, fields) {
        if (error) {
          res.status(500).send('Error: ' + error.code);
          console.log('Error: ' + error.code);
        } else {
          console.log(results[0]);
          res.send({'dreamHouse': results[0]});
          console.log('Sent dream house with id: ' + dhid);
        }
      });
    }
  });
});

// add a criteria object to a House
app.post('/api/addCriterion', function(req, res) {
  var authHeader = req.headers.authorization;
  var claims = decodeToken(authHeader);
  if (!checkClaims(claims)) {
    res.status(403).send('Forbidden.');
    return;
  }

  var uid = claims['uid']
  var hid = req.body['hid'];
  var name = req.body['name'];
  var category = req.body['category'];

  if (category == null) {
    category = 'other'
  }

  connection.query('SELECT * FROM UserHouseRelationship WHERE (id = ? AND hid = ?)', [uid, hid], function(error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else if (results.length >= 1) {
      connection.query('INSERT INTO Criteria (hid, name, category) VALUES(?, ?, ?)', [hid, name, category], function(error, results, fields){
        if (error) {
          throw error
          res.status(500).send('Error: ' + error.code);
          console.log('Error: ' + error.code);
        } else {
          res.send('Criterion added.');
          console.log('Added Criterion to house: ' + hid);
        }
      });
    } else {
      res.status(500).send('Access to criteria for this house is not permitted.');
      console.log('Invalid house access for user: ' + uid);
    }
  });
});


// Get a list of criteria for a house
app.post('/api/getCriteria', function(req, res) {
  var authHeader = req.headers.authorization;
  var claims = decodeToken(authHeader);
  if (claims === null) {
    res.status(403).send('Forbidden');
    return;
  }

  var uid = claims['uid'];
  var hid = req.body['hid'];

  connection.query('SELECT * FROM UserHouseRelationship WHERE (id = ? AND hid = ?)', [uid, hid], function(error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else {
      if (results.length >= 1) {
        connection.query('SELECT * FROM Criteria WHERE (hid = ?) ORDER BY category ASC, name ASC', hid, function(error, results, fields) {
          if (error) {
            res.status(500).send('Error: ' + error.code);
            console.log('Error: ' + error.code);
          } else {
            res.send(results);
            console.log('Sent criteria for house: ' + hid);
          }
        });
      } else {
        res.status(500).send('Access to criteria for this house is not permitted.');
        console.log('Invalid house access for user: ' + uid);
      }
    }
  });
});


// Remove Criterion from the Criteria table
app.post('/api/deleteCriterion', function(req, res) {
  var authHeader = req.headers.authorization;
  var claims = decodeToken(authHeader);
  if (!checkClaims(claims)) {
    res.status(403).send('Forbidden');
    return;
  }

  var uid = claims['uid'];
  var id = req.body['id'];
  var hid = req.body['hid'];

  connection.query('SELECT * FROM UserHouseRelationship WHERE (id = ? AND hid = ?)', [uid, hid], function(error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else {
      if (results.length >= 1) {
        connection.query('DELETE FROM Criteria WHERE (id = ? AND hid = ?)', [id, hid], function(error, results, fields) {
          if (error) {
            res.status(500).send('Error: ' + error.code);
            console.log('Error: ' + error.code);
          } else {
            res.send('Criteria deleted.');
            console.log('Deleted criteria with id: ' + id);
          }
        });
      } else {
        res.status(500).send('Deletion of this criteria not permitted.');
        console.log('Invalid criteria access for user: ' + uid);
      }
    }
  });
})

// Update criteria value
app.post('/api/updateCriterion', function(req, res) {
  var authHeader = req.headers.authorization;
  var claims = decodeToken(authHeader);
  if (!checkClaims(claims)) {
    res.status(403).send('Forbidden');
    return;
  }

  var uid = claims['uid'];
  var id = req.body['id'];
  var hid = req.body['hid'];
  var value = req.body['value'];

  if (value == null) {
    res.status(500).send('Error: must send a value to update');
    console.log('Invalid parameters for update criteria for user: ' + uid);
    return;
  }

  connection.query('SELECT * FROM UserHouseRelationship WHERE (id = ? AND hid = ?)', [uid, hid], function(error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else {
      if (results.length >= 1) {
        connection.query('UPDATE Criteria SET value = ? WHERE (id = ? AND hid = ?)', [value, id, hid], function(error, results, fields) {
          if (error) {
            res.status(500).send('Error: ' + error.code);
            console.log('Error: ' + error.code);
          } else {
            res.send('Criteria updated.');
            console.log('Updated criteria with id: ' + id);
          }
        });
      } else {
        res.status(500).send('Modifying of this criteria not permitted.');
        console.log('Invalid criteria access for user: ' + uid);
      }
    }
  });
});


// Logout a user and mark their session token as 'inactive'
app.post('/api/logout', function(req,res) {
  //code
})


// Remove user from the database
app.post('/api/deleteUser', function (req, res) {
  var uid = req.body["id"];
  connection.query('DELETE FROM UserHouseRelationship WHERE (id = ? AND hid = ?)', [uid, hid], function(error, results, fields) {
    if (error) {
      res.status(500).send('Error: ' + error.code);
      console.log('Error: ' + error.code);
    } else {
      res.send('Successfully Removed User');
      console.log('Removed user with id: ' + uid);
    }
  });
});


connection.connect();
app.listen(8081, function() {
    console.log('Server ready');
});
