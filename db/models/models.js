const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema({
  classroom: {
    type: Object,
    required: true,
  },
  _teacherId: {
    type: String,
    required: false,
  },
  name: {
    type: String,
    required: true,
    minlength: 1,
    trim: true,
  },
  gender: {
    type: String,
    required: false,
  },

  contact_details: [
    {
      type: {
        type: String,
        required: false
      },

      value: {
        type: String,
        required: false,
        default: ""
      },
    },
    {
      type: {
        type: String,
        required: false
      },

      value: {
        type: String,
        required: false,
        default: ""
      },
    },
    {
      type: {
        type: String,
        required: false
      },

      value: {
        type: String,
        required: false,
        default: ""
      },
    },
  ],
  absences: [
    {
      date: {
        type: Date,
        required: false,
        default: Date.now()
      },
      type: {
        type: String,
        required: true,
      },
      comment: {
        type: String,
        required: true,
      },
    },
  ],

  feedback: [
    {
      date: {
        type: Date,
        required: true,
        default: Date.now()
      },
      type: {
        type: String,
        required: true,
      },
      comment: {
        type: String,
        required: true,
      },
    },
  ],
});

const Student = mongoose.model("Student", StudentSchema);

const ClassroomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 1,
    trim: true,
  },
  grade: {
    type: Number,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  created: {
    type: Date,
    required: true,
  },

  notes: [
    {
      date: {
        type: Date,
        required: false,
        default: Date.now()
      },
      title: {
        type: String,
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
    },
  ],
  activities: [
    {
      date: {
        type: Date,
        required: false,
        default: Date.now()
      },
      type: {
        type: String,
        required: false,
      },
      focus: {
        type: String,
        required: false,
      },
      aim: {
        type: String,
        required: false,
      },
      preparation: {
        type: String,
        required: true,
      },
      level: {
        type: String,
        required: false,
      },
      time: {
        type: String,
        required: false,
      },
      introduction: {
        type: String,
        required: true,
      },
      procedure: {
        type: Array,
      required: true,
      },
    },
  ],
  groups: [
    {
      name: {
        type: String,
        required: true
      },
      color: {
        type: String,
        required: true
      },
      students: [
        {
          _id: { 
            type: String,
            required: true
          },
          name: {
            type: String,
            required: true
          }
        }
      ]
    }
  ]
});

const Classroom = mongoose.model("Classroom", ClassroomSchema);

module.exports = {
  Student,
  Classroom,
};
