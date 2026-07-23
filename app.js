var express = require('express');
var mysql = require('mysql2');
const { google } = require('googleapis');

const serviceAccountKeyFile = "./a-care-419506-c05dfc6ea5a6.json";
const sheetId = '1vHRwL9SqsAFnSJm5tJw1Lf_VetZdIrCj1WByUp00rfM'



async function _getGoogleSheetClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: serviceAccountKeyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  return google.sheets({
    version: 'v4',
    auth: authClient,
  });
}

async function _readGoogleSheet(tabName) {
  const range = 'A2:E'
  const googleSheetClient = await _getGoogleSheetClient();
  const res = await googleSheetClient.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tabName}!${range}`,
  });

  return res.data.values;
}

async function _writeGoogleSheet(googleSheetClient,data ,tabName) {
  // const data = [
  //   ['11', 'rohith', 'Rohith', 'Sharma', 'Active'],
  //   ['12', 'virat', 'Virat', 'Kohli', 'Active']
  // ]
  // const googleSheetClient = await _getGoogleSheetClient();
  await googleSheetClient.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tabName}!A2:E`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      "majorDimension": "ROWS",
      "values": data
    },
  })
}


const bodyParser = require('body-parser');
const app = express();
const port = 55966

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

const db = mysql.createConnection({
  host: 'mysql-14d2f91d-acareapp.g.aivencloud.com',
  user: 'avnadmin',
  password: 'AVNS_J-RbHTSoppWlru-18er',
  database: 'defaultdb',
  port: 20518,
  ssl: { rejectUnauthorized: false } // สำคัญมาก: Aiven บังคับให้เปิด SSL ครับ
});

db.connect((err) => {
  if (err) {
    console.log("Connect Aiven MySQL failed:", err.message);
    return;
  }
  console.log("Connected to Aiven MySQL successfully!");
});

db.connect((err) => {
  if (err) {
    return console.error('error: ' + err.message);
  }
  console.log('Connected to the MySQL server.');
});

app.use(express.static('public'))

app.get('/posts',async (req, res) => {
  try {
    // Read data from Google Sheet
    const data = await _readGoogleSheet("bmi_tdee");
    // console.log(data);
    // Transform the data into a similar structure as the SQL query result
    const transformedData = data.reduce((acc, cur) => {
      const [sex, age, bmi, bmr, tdee] = cur;
      if (!acc[sex]) {
        acc[sex] = { sex, count: 0, total_age: 0, total_bmi: 0, total_bmr: 0, total_tdee: 0 };
      }
      acc[sex].count += 1;
      acc[sex].total_age += parseFloat(age);
      acc[sex].total_bmi += parseFloat(bmi);
      acc[sex].total_bmr += parseFloat(bmr);
      acc[sex].total_tdee += parseFloat(tdee);
      return acc;
    }, {});
    // console.log(transformedData);
    // Calculate averages
    const results = Object.values(transformedData).map(item => ({
      sex: item.sex,
      count: item.count,
      avg_age: item.total_age / item.count,
      avg_bmi: item.total_bmi / item.count,
      avg_bmr: item.total_bmr / item.count,
      avg_tdee: item.total_tdee / item.count,
    }));

    // Perform aggregation similar to your original logic
    const totalCount = results.reduce((acc, cur) => acc + cur.count, 0);
    const totalAvgAge = results.reduce((acc, cur) => acc + (cur.avg_age * cur.count), 0) / totalCount;
    const totalAvgBmi = results.reduce((acc, cur) => acc + (cur.avg_bmi * cur.count), 0) / totalCount;
    const totalAvgBmr = results.reduce((acc, cur) => acc + (cur.avg_bmr * cur.count), 0) / totalCount;
    const totalAvgtdee = results.reduce((acc, cur) => acc + (cur.avg_tdee * cur.count), 0) / totalCount;
    res.json({
      total: {
        count: totalCount,
        avg_age: totalAvgAge,
        avg_bmi: totalAvgBmi,
        avg_bmr: totalAvgBmr,
        avg_tdee: totalAvgtdee,
      },
      sex: results
    });
  } catch (err) {
    console.error('Error calculating aggregates from Google Sheet:', err);
    throw err; // or handle the error as needed
  }
});

app.post('/posts_data', async (req, res)  => {
  const googleSheetClient = await _getGoogleSheetClient();
  const { sex1, age1, bmi, bmr, tdee } = req.body;
  if (sex1 != "female" && sex1 != "male") {
    return res.status(400).send("Who the fuck are u bitch! i got ur ip now hahaha!");
  }
  _writeGoogleSheet(googleSheetClient,[[sex1, age1, bmi, bmr, tdee]],"bmi_tdee");
});

app.post('/posts_feedback', async (req, res)  => {
  const googleSheetClient = await _getGoogleSheetClient();
  const { fn, em, msg } = req.body;
  if(fn === undefined || em === undefined || msg === undefined){
    return res.status(400).send("Who the fuck are u bitch! i got ur ip now hahaha!");
  }
  _writeGoogleSheet(googleSheetClient,[[fn, em, msg]],"feedback");
  // db.query('INSERT INTO web (sex, age, bmi,bmr,tdee) VALUES (?, ?, ?,?,?)', [sex1, age1, bmi, bmr, tdee], (err, result) => {
  //   if (err) {
  //     return console.error(err.message);
  //   }
  //   res.send({ id: result.insertId, sex1, age1, bmi, bmr, tdee });
  // });
});

const serverPort = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.listen(serverPort, () => {
  console.log(`Listening on port ${serverPort}...`);
});