const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const db = require('./db/db');
const moment = require('moment');
const app = express();
const router = express.Router();

const clientID = '54287';
const clientSecret = 'edee55f0ee48c484314874c9b18a33b5e4a135bf';
let accessToken = '';

router.get('/api/exchange_token', (req, res) => {
  const token = req.query.code;
  fetch(
    `https://www.strava.com/api/v3/oauth/token?client_id=${clientID}&client_secret=${clientSecret}&code=${token}&grant_type=authorization_code`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
      },
    }
  )
    .then((response) => response.json())
    .then((athleteStrava) => {
      console.log('accesstoken====', athleteStrava);
      accessToken = athleteStrava.athlete.access_token = athleteStrava.access_token;
      athleteStrava.athlete.expires_at = athleteStrava.expires_at;
      athleteStrava.athlete.expires_in = athleteStrava.expires_in;
      athleteStrava.athlete.refresh_token = athleteStrava.refresh_token;
      db.saveAthlete(payloadAthlete(athleteStrava.athlete))
        .then(() => {
          res.clearCookie();
          res.cookie('accessToken', accessToken,{ maxAge: 6*3600000});
          res.redirect(`http://localhost:${uiPORT}/leaderboard`);
        })
        .catch(() => {
        });
    })
    .catch((err) => {
      console.log(err.message);
    });
});

router.post('/api/refreshAccessToken', (req,res) => {
  db.getAthletes(req.body).then((athlete) => {
  refreshToken(athlete._doc.refreshToken).then((athleteStravaData) =>{
      db.updateAthlete(
        { refreshToken: athleteStravaData.refresh_token },
        {
          accessToken: athleteStravaData.access_token,
          expiresAt: athleteStravaData.expires_at,
          expiresIn: athleteStravaData.expires_in,
        }
      ).then((result)=>{
        res.cookie('accessToken', result.accessToken,{ maxAge: 6*3600000});
        res.json({
          success: 'ok',
          data: athlete,
        });
      })
    })
  });
});

const refreshToken = (token) => {
  return fetch(
    `https://www.strava.com/api/v3/oauth/token?client_id=${clientID}&client_secret=${clientSecret}&grant_type=refresh_token&refresh_token=${token}`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
      },
    }
  ).then((response) => response.json())
};

router.get('/api/refreshAccessTokens', (req, res) => {
  db.getAthletes().then((athletes) => {
    let promises = [];
    athletes.forEach((athlete) => {
      if (moment().isAfter(moment.unix(athlete._doc.expiresAt))) {
        promises.push(
          refreshToken(athlete._doc.refreshToken)
        );
      }
    });
    Promise.allSettled(promises).then((response) => {
      promises = [];
      //TODO setting accessToken
      response.forEach((tokenResult) => {
        if (tokenResult.value.errors === undefined) {
          tokenResult = tokenResult.value;
          promises.push(
            db.updateAthlete(
              { refreshToken: tokenResult.refresh_token },
              {
                accessToken: tokenResult.access_token,
                expiresAt: tokenResult.expires_at,
                expiresIn: tokenResult.expires_in,
              }
            )
          );
        }
      });
      Promise.allSettled(promises)
        .then((results) => {
          accessToken = accessToken === '' && results.length > 0? results[0]?.value?.access_token : accessToken;
          res.json({
            success: 'ok',
            data: results,
          });
        })
        .catch();
    });
  });
});

router.get('/api/getClubDetails', (req,res) => {
  const clubId = '675234';
  fetch(
    `https://www.strava.com/api/v3/clubs/${clubId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  ).then(response => response.json())
  .then((response) => {
    res.json({
      success: 'ok',
      data: response,
    });
  });
})

router.get('/api/getAthletes', (req, res) => {
  const query = req.query;
  if (Object.keys(query).length === 0) {
    db.getAthletes()
      .then((athlete) => {
        res.json({
          success: 'ok',
          data: athlete,
        });
      })
      .catch((err) => {
        res.json({
          success: 'fail',
          data: err,
        });
      });
  } else {
    db.getAthlete(query)
      .then((athlete) => {
        res.json({
          success: 'ok',
          data: athlete,
        });
      })
      .catch((err) => {
        res.json({
          success: 'fail',
          data: err,
        });
      });
  }
});

router.post('/api/athlete', (req, res) => {
  db.saveAthlete(payloadAthlete(req.body))
    .then((athlete) => {
      res.json({
        success: 'ok',
        data: athlete,
      });
    })
    .catch((err) => {
      res.json({
        success: 'fail',
        data: err,
      });
    });
});

router.get('/api/activities', (req, res) => {
  db.getAthletes().then((athletes) => {
    let promises = [];
    athletes.forEach((athlete) => {
      promises.push(
        fetch('https://www.strava.com/api/v3/athlete/activities', {
          headers: { Authorization: `Bearer ${athlete._doc.accessToken}` },
        }).then((response) => response.json())
      );
    });
    Promise.allSettled(promises)
      .then((response) => {
        const results = response.filter((data, index) => {
          if (data.value.errors === undefined) {
            data.athleteName = athletes[index]._doc.name;
            return data;
          }
        });
        res.json({
          success: 'ok',
          data: results,
        });
      })
      .catch();
  });
});

const payloadAthlete = (athlete) => {
  return {
    athleteId: athlete.id,
    name: athlete.firstname + ' ' + athlete.lastname,
    accessToken: athlete.access_token,
    expiresAt: athlete.expires_at,
    expiresIn: athlete.expires_in,
    refreshToken: athlete.refresh_token,
  };
};

const uiPORT = '8080';
//configure
const corsOptions = {
  origin: `http://localhost:${uiPORT}`,
};
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(bodyParser.json());
const routerPath = '/'//process.env.NODE_ENV === 'localhost' ? '/': '/';
app.use(routerPath, router);
module.exports = app;
