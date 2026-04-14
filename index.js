const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config()

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cors())

const PORT = process.env.PORT || 3001;

const authRoute = require('./routes/auth_routes')
const employeeRoute = require('./routes/employee')
const settings = require('./routes/settings')
const attendanceRoute = require('./routes/attendance');


app.use('/api/v1/auth', authRoute)
app.use('/api/v1/users', employeeRoute)
app.use('/api/v1/settings', settings)
app.use('/api/v1/attendance', attendanceRoute);



//Backend server 
// const server = require('http').createServer(app);

app.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`)
)