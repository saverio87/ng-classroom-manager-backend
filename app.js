const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");

const { mongoose } = require("./db/mongoose");

const app = express();

// Loading Mongoose models

const { Student, Classroom, User } = require("./db/models/models");

// MIDDLEWARES

// Body parser middleware

app.use(bodyParser.json());

// Cors headers middleware

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id"
  );

  res.header(
    "Access-Control-Expose-Headers",
    "x-access-token, x-refresh-token"
  );

  next();
});

// check whether the request has a valid JWT access token

let authenticate = (req, res, next) => {
  let token = req.header("x-access-token");

  // verify the JWT
  jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
    if (err) {
      // there was an error
      // jwt is invalid - * DO NOT AUTHENTICATE *
      res.status(401).send(err);
    } else {
      // jwt is valid
      req.user_id = decoded._id;
      next();

      // We are setting the value of user_id - by adding this to
      // the headers we will limit which students / classrooms the
      // user has access to when making API calls
    }
  });
};

// Verify Refresh Token Middleware (which will be verifying the session)

let verifySession = (req, res, next) => {
  // grab the refresh token from the request header
  let refreshToken = req.header("x-refresh-token");

  // grab the _id from the request header
  let _id = req.header("_id");

  User.findByIdAndToken(_id, refreshToken)
    .then((user) => {
      if (!user) {
        // user couldn't be found
        return Promise.reject({
          error:
            "User not found. Make sure that the refresh token and user id are correct",
        });
      }

      // if the code reaches here - the user was found
      // therefore the refresh token exists in the database - but we still have to check if it has expired or not

      req.user_id = user._id;
      req.userObject = user;
      req.refreshToken = refreshToken;

      let isSessionValid = false;

      user.sessions.forEach((session) => {
        if (session.token === refreshToken) {
          // check if the session has expired
          if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
            // refresh token has not expired
            isSessionValid = true;
          }
        }
      });

      if (isSessionValid) {
        // the session is VALID - call next() to continue with processing this web request
        next();
      } else {
        // the session is not valid
        return Promise.reject({
          error: "Refresh token has expired or the session is invalid",
        });
      }
    })
    .catch((e) => {
      res.status(401).send(e);
    });
};

// ROUTE HANDLER

/* USER ROUTES */

/**
 * POST /users
 * Purpose: Sign up
 */

app.post("/users", (req, res) => {
  // User sign up

  let body = req.body;
  let newUser = new User(body);

  newUser
    .save()
    .then(() => {
      return newUser.createSession();
    })
    .then((refreshToken) => {
      // Session created successfully - refreshToken returned.
      // now we geneate an access auth token for the user

      return newUser.generateAccessAuthToken().then((accessToken) => {
        // access auth token generated successfully, now we return an object containing the auth tokens
        return { accessToken, refreshToken };
      });
    })
    .then((authTokens) => {
      // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
      res
        .header("x-refresh-token", authTokens.refreshToken)
        .header("x-access-token", authTokens.accessToken)
        .send(newUser);
    })
    .catch((e) => {
      res.status(400).send(e);
    });
});

/**
 * POST /users/login
 * Purpose: Login
 */
app.post("/users/login", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;

  User.findByCredentials(email, password)
    .then((user) => {
      return user
        .createSession()
        .then((refreshToken) => {
          // Session created successfully - refreshToken returned.
          // now we geneate an access auth token for the user

          return user.generateAccessAuthToken().then((accessToken) => {
            // access auth token generated successfully, now we return an object containing the auth tokens
            return { accessToken, refreshToken };
          });
        })
        .then((authTokens) => {
          // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
          res
            .header("x-refresh-token", authTokens.refreshToken)
            .header("x-access-token", authTokens.accessToken)
            .send(user);
        });
    })
    .catch((e) => {
      res.status(400).send(e);
    });
});

/**
 * GET /users/me/access-token
 * Purpose: generates and returns an access token
 */
app.get("/users/me/access-token", verifySession, (req, res) => {
  // we know that the user/caller is authenticated and we have the user_id and user object available to us
  req.userObject
    .generateAccessAuthToken()
    .then((accessToken) => {
      res.header("x-access-token", accessToken).send({ accessToken });
    })
    .catch((e) => {
      res.status(400).send(e);
    });
});

/* STUDENT ROUTES */

// GET

/**
 * GET /students
 * Purpose: Get all students
 */

app.get("/students", authenticate, (req, res) => {
  Student.find({
    _userId: req.user_id,
  }).then((students) => {
    if (students.length < 1) {
      res.send("There are no students at the moment");
    }

    res.send(students);
  });
});

/**
 * GET /student/:id
 * Purpose: Get single student
 */
app.get("/students/:id", authenticate, (req, res) => {
  Student.findOne({
    _id: req.params.id,
    _userId: req.user_id,
  }).then((student) => {
    if (!student) {
      res.send("Couldn't fetch the student");
    }

    res.send(student);
  });
});

// POST

/**
 * POST /students/add
 * Purpose: Create a student
 */

app.post("/students/add", authenticate, async (req, res) => {
  let student = req.body;

  try {
    let newStudent = new Student({
      _userId: req.user_id,
      name: student.name,
      gender: student.gender,
      classroom: student.classroom,
      contact_details: [
        {
          type: "email",
          value: "",
        },
        {
          type: "phone",
          value: "",
        },
        {
          type: "wechat",
          value: "",
        },
      ],
      absences: student.absences,
      feedback: student.feedback,
    });

    const response = await newStudent.save();
    res.json(response);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

app.post(
  "/students/add/many",
  authenticate,
  async (req, res) => {
    let students = req.body;
    let savedStudents = [];
    let studentsNotSaved = [];
    for (el of students) {
      try {
        let newStudent = new Student({
          _userId: req.user_id,
          name: el.name,
          gender: el.gender,
          classroom: el.classroom,
          contact_details: [
            {
              type: "email",
              value: "",
            },
            {
              type: "phone",
              value: "",
            },
            {
              type: "wechat",
              value: "",
            },
          ],
        });

        savedStudents.push(await newStudent.save());
      } catch (error) {
        studentsNotSaved.push(el);
        console.error(err.message);
        console.log("The following students were not saved:");
        console.log(studentsNotSaved);
        res.status(500).send("Server error");
      }
    }

    return res.send(savedStudents);
  }
  // We want to create a new list and return the new list document back to the user (which includes the id)
  // The list information (fields) will be passed in via the JSON request body
);

/**
 * POST /students/:id/contact-details
 * Purpose: Add contact details
 * Remove this, on student creation three contact details objects are
 * generated automatically and assigned an ID
 */

app.post("/students/:id/contact-details", authenticate, async (req, res) => {
  const { type, value } = req.body;
  const newContactDetail = { type, value };

  try {
    const student = await Student.findOne({
      _id: req.params.id,
      _userId: req.user_id,
    });
    student.contact_details.push(newContactDetail);

    await student.save();
    res.json(student);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// PATCH

/**
 * PATCH /students/:id
 * Purpose: Update a student info
 */

app.patch("/students/:id", authenticate, (req, res) => {
  // We want to update the specified list (list document with id in the URL) with the new values specified in the JSON body of the request

  Student.findOneAndUpdate(
    {
      _id: req.params.id,
      _userId: req.user_id,
    },
    {
      $set: req.body,
    }
  ).then(() => {
    res.send({ message: "updated successfully" });
  });
});

/**
 * PATCH /students/:id/contact-details/:contact-detail
 * Purpose: Create and / or update contact details
 **/

app.patch(
  "/students/:id/contact-details/:item_id",
  authenticate,
  async (req, res) => {
    const { type: newType, value } = req.body;

    try {
      let student = await Student.findOne({
        _id: req.params.id,
        _userId: req.user_id,
      });
      student.contact_details = student.contact_details.map((item) => {
        if (item._id == req.params.item_id) {
          item.type = item.type ? item.type : newType;
          item.value = value;
        }
        return item;
      });

      await student.save();
      res.json(student);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

/**
 * PATCH /students/:id/absences
 * Purpose: Create and / or update absences
 **/

app.patch("/students/:id/absences", authenticate, async (req, res) => {
  let data = req.body;

  try {
    let student = await Student.findOne({
      _id: req.params.id,
      _userId: req.user_id,
    });

    student.absences.unshift(data);
    await student.save();
    res.json(student);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

/**
 * PATCH /students/:id/feedback
 * Purpose: Create and / or update feedback
 **/

app.patch("/students/:id/feedback", authenticate, async (req, res) => {
  let data = req.body;

  try {
    let student = await Student.findOne({
      _id: req.params.id,
      _userId: req.user_id,
    });

    student.feedback.unshift(data);
    await student.save();
    res.json(student);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// DELETE

/**
 * DELETE /student/:id
 * Purpose: Delete a student
 */
app.delete("/students/:id", authenticate, (req, res) => {
  Student.findOneAndRemove({
    _id: req.params.id,
    _userId: req.user_id,
  }).then((removedStudent) => {
    res.send({
      message: "student deleted successfully",
      removedList: removedStudent,
    });
  });
});

/**
 * DELETE /students/:id/contact-details/:contact-detail
 * Purpose: Delete student's contact details
 */

app.delete(
  "/students/:id/contact-details/:item_id",
  authenticate,
  async (req, res) => {
    try {
      let student = await Student.findOne({
        _id: req.params.id,
        _userId: req.user_id,
      });

      // student.contact_details = student.contact_details.filter((item) => {
      //   console.log(item._id.toString(), req.params.item_id);
      //   return item._id.toString() !== req.params.item_id;
      // });
      student.contact_details = student.contact_details.map((item) => {
        if (item._id == req.params.item_id) {
          item.value = "";
        }
        return item;
      });

      await student.save();
      res.json(student);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

/**
 * DELETE /students/:id/feedback/:feedback
 * Purpose: Delete contact details
 */

app.delete(
  "/students/:id/feedback/:item_id",
  authenticate,
  async (req, res) => {
    try {
      let student = await Student.findOne({
        _id: req.params.id,
        _userId: req.user_id,
      });

      student.feedback = student.feedback.filter((item) => {
        return item._id != req.params.item_id;
      });

      await student.save();
      res.json(student);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

/**
 * DELETE /students/:id/absences/:absence
 * Purpose: Delete absences
 */

app.delete(
  "/students/:id/absences/:item_id",
  authenticate,
  async (req, res) => {
    try {
      let student = await Student.findOne({
        _id: req.params.id,
        _userId: req.user_id,
      });

      student.absences = student.absences.filter((item) => {
        return item._id != req.params.item_id;
      });

      await student.save();
      res.json(student);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

/**
 * DELETE /students/:id
 * Purpose: Delete a student
 */
app.delete("/students/:id", authenticate, (req, res) => {
  // We want to delete the specified list (document with id in the URL)

  Student.findOneAndRemove({
    _id: req.params.id,
    _userId: req.user_id,
  }).then((removedListDoc) => {
    res.send({
      message: "list deleted successfully",
      removedList: removedListDoc,
    });
  });
});

/* CLASSROOM ROUTES */

// GET

/**
 * GET /classrooms/
 * Purpose: Get all classrooms
 */
app.get("/classrooms", authenticate, (req, res) => {
  Classroom.find({
    _userId: req.user_id,
  }).then((classrooms) => {
    if (classrooms.length < 1) {
      res.send("There are no classrooms at the moment");
    }

    res.send(classrooms);
  });
});

// POST

/**
 * POST /classrooms
 * Purpose: Create a classroom
 */

app.post("/classrooms", authenticate, (req, res) => {
  let data = req.body;

  let newClassroom = new Classroom({
    name: data.name,
    grade: data.grade,
    year: data.year,
    created: Date.now(),
    notes: data.notes,
    activities: data.activities,
    _userId: req.user_id,
  });

  newClassroom.save().then((listDoc) => {
    // the full list document is returned (incl. id)
    res.send(listDoc);
  });
});

// PATCH

/**
 * PATCH /classrooms/:id/groups
 * Purpose: Create and / or update student groups in classroom
 **/

app.patch("/classrooms/:id/groups", authenticate, async (req, res) => {
  const data = req.body;
  const newGroups = [];

  for (group of data) {
    newGroups.push(group);
  }

  try {
    let classroom = await Classroom.findOne({
      _id: req.params.id,
      _userId: req.user_id,
    });

    classroom.groups = newGroups;
    await classroom.save();
    res.json(classroom);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

/**
 * PATCH /classrooms/:id/notes
 * Purpose: Create and / or update notes in classroom
 **/

app.patch("/classrooms/:id/notes", authenticate, async (req, res) => {
  const data = req.body;
  const newNote = {
    date: data.date,
    title: data.title,
    content: data.content,
  };

  try {
    let classroom = await Classroom.findOne({
      _id: req.params.id,
      _userId: req.user_id,
    });

    classroom.notes.unshift(newNote);
    await classroom.save();
    res.json(classroom);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

/**
 * PATCH /classrooms/:id/activities
 * Purpose: Create and / or update activities
 **/

app.patch("/classrooms/:id/activities", authenticate, async (req, res) => {
  const data = req.body;

  const newActivity = {
    date: data.date,
    type: data.type,
    focus: data.focus,
    aim: data.aim,
    preparation: data.preparation,
    level: data.level,
    time: data.time,
    introduction: data.introduction,
    procedure: data.procedure,
  };

  try {
    let classroom = await Classroom.findOne({
      _id: req.params.id,
      _userId: req.user_id,
    });

    classroom.activities.unshift(newActivity);
    await classroom.save();
    res.json(classroom);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// DELETE

/**
 * DELETE /classroom/:id
 * Purpose: Delete a classroom
 */
app.delete("/classrooms/:id", authenticate, (req, res) => {
  Classroom.findOneAndRemove({
    _id: req.params.id,
    _userId: req.user_id,
  }).then((removedClassroom) => {
    res.send({
      message: "classroom deleted successfully",
      removedList: removedClassroom,
    });
  });
});

/**
 * DELETE /classrooms/:id/notes/:item_id
 * Purpose: Delete all notes from a classroom
 */

//  app.delete("/classrooms/:id/notes", async (req, res) => {
//   try {
//     let classroom = await Classroom.findOne({ _id: req.params.id });

//     classroom.notes = [];

//     await classroom.save();
//     res.json(classroom);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send("Server error");
//   }
// });

/**
 * DELETE /classrooms/:id/notes/:item_id
 * Purpose: Delete classrooms notes
 */

app.delete("/classrooms/:id/notes/:item_id", authenticate, async (req, res) => {
  try {
    let classroom = await Classroom.findOne({
      _id: req.params.id,
      _userId: req.user_id,
    });

    classroom.notes = classroom.notes.filter((item) => {
      return item._id != req.params.item_id;
    });

    await classroom.save();
    res.json(classroom);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

/**
 * DELETE /classrooms/:id/activities/:item_id
 * Purpose: Delete classrooms activities
 */

app.delete(
  "/classrooms/:id/activities/:item_id",
  authenticate,
  async (req, res) => {
    try {
      let classroom = await Classroom.findOne({
        _id: req.params.id,
        _userId: req.user_id,
      });

      classroom.activities = classroom.activities.filter((item) => {
        return item._id != req.params.item_id;
      });

      await classroom.save();
      res.json(classroom);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// /**
//  * PATCH /lists/:listId/tasks/:taskId
//  * Purpose: Update an existing task
//  */
// app.patch("/lists/:listId/tasks/:taskId", authenticate, (req, res) => {
//   // We want to update an existing task (specified by taskId)

//   List.findOne({
//     _id: req.params.listId,
//     _userId: req.user_id,
//   })
//     .then((list) => {
//       // evaluates as true - list object is valid
//       // the authenticated user can update new tasks
//       if (list) {
//         return true;
//       }
//       return false;
//     })
//     .then((canUpdateTask) => {
//       if (canUpdateTask) {
//         Task.findOneAndUpdate(
//           {
//             _listId: req.params.listId,
//             _id: req.params.taskId,
//           },
//           {
//             $set: req.body,
//           }
//         ).then((UpdatedTask) => {
//           res.send({
//             message: "Updated successfully",
//             updatedTask: UpdatedTask,
//           });
//         });
//       } else {
//         res.sendStatus(404);
//       }
//     });
// });

// /**
//  * DELETE /lists/:listId/tasks/:taskId
//  * Purpose: Delete a task
//  */
// app.delete("/lists/:listId/tasks/:taskId", authenticate, (req, res) => {
//   List.findOne({
//     _id: req.params.listId,
//     _userId: req.user_id,
//   })
//     .then((list) => {
//       // evaluates as true - list object is valid
//       // the authenticated user can delete new tasks
//       if (list) {
//         return true;
//       }
//       return false;
//     })
//     .then((canDeleteTask) => {
//       if (canDeleteTask) {
//         Task.findOneAndRemove({
//           _listId: req.params.listId,
//           _id: req.params.taskId,
//         }).then((removedTaskDoc) => {
//           res.send({
//             message: "Deleted successfully",
//             removedTask: removedTaskDoc,
//           });
//         });
//       } else {
//         res.sendStatus(404);
//       }
//     });
// });

// /* USER ROUTES */

// /**
//  * POST /users
//  * Purpose: Sign up
//  */
// app.post("/users", (req, res) => {
//   // User sign up

//   let body = req.body;
//   let newUser = new User(body);

//   newUser
//     .save()
//     .then(() => {
//       return newUser.createSession();
//     })
//     .then((refreshToken) => {
//       // Session created successfully - refreshToken returned.
//       // now we geneate an access auth token for the user

//       return newUser.generateAccessAuthToken().then((accessToken) => {
//         // access auth token generated successfully, now we return an object containing the auth tokens
//         return { accessToken, refreshToken };
//       });
//     })
//     .then((authTokens) => {
//       // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
//       res
//         .header("x-refresh-token", authTokens.refreshToken)
//         .header("x-access-token", authTokens.accessToken)
//         .send(newUser);
//     })
//     .catch((e) => {
//       res.status(400).send(e);
//     });
// });

// /**
//  * POST /users/login
//  * Purpose: Login
//  */
// app.post("/users/login", (req, res) => {
//   let email = req.body.email;
//   let password = req.body.password;

//   User.findByCredentials(email, password)
//     .then((user) => {
//       return user
//         .createSession()
//         .then((refreshToken) => {
//           // Session created successfully - refreshToken returned.
//           // now we geneate an access auth token for the user

//           return user.generateAccessAuthToken().then((accessToken) => {
//             // access auth token generated successfully, now we return an object containing the auth tokens
//             return { accessToken, refreshToken };
//           });
//         })
//         .then((authTokens) => {
//           // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
//           res
//             .header("x-refresh-token", authTokens.refreshToken)
//             .header("x-access-token", authTokens.accessToken)
//             .send(user);
//         });
//     })
//     .catch((e) => {
//       res.status(400).send(e);
//     });
// });

// /**
//  * GET /users/me/access-token
//  * Purpose: generates and returns an access token
//  */
// app.get("/users/me/access-token", verifySession, (req, res) => {
//   // we know that the user/caller is authenticated and we have the user_id and user object available to us
//   req.userObject
//     .generateAccessAuthToken()
//     .then((accessToken) => {
//       res.header("x-access-token", accessToken).send({ accessToken });
//     })
//     .catch((e) => {
//       res.status(400).send(e);
//     });
// });

// let deleteTasksFromList = (_listId) => {
//   Task.deleteMany({
//     _listId: _listId,
//   }).then(() => {
//     console.log("Tasks in list" + _listId + "were successfully deleted");
//   });
// };

app.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
