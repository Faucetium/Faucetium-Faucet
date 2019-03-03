// libraries
const request = require('request')

//functions

const getCaptchaResponse = async (config, req, ip) => {
  return new Promise(resolve => {
    /*
      Send a http POST to  with the following parameters:

    privatekey
        Your verification key (V-Key)
    challenge
        The puzzle challenge identifier - typically found in the form field adcopy_challenge
    response
        The user's answer from the form field adcopy_response
    remoteip
        The user's IP address
      */

    let body = '';

    // Your verification key (V-Key)
    body += `privatekey=${config.verificationKey}`;
    body += '&';

    // The puzzle challenge identifier - typically found in the form field adcopy_challenge
    const challenge = req.body.adcopy_challenge;
    body += `challenge=${challenge}`;
    body += '&';

    // The user's answer from the form field adcopy_response
    const response = req.body.adcopy_response;
    body += `response=${response}`;
    body += '&';

    //    The user's IP address
    body += `remoteip=${ip}`;

    // console.log('submitting', body);

    request({
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      uri: 'http://verify.solvemedia.com/papi/verify',
      body: body,
      method: 'POST',
      timeout: 30000
    }, (err, httpResponse, response) => {
      // console.log('sendRequest body', body);
      // console.log('sendRequest err', err);
      // console.log('sendRequest httpResponse', httpResponse);
      // console.log('sendRequest response', response);
      resolve(response);
    });
  });
}

exports.getCaptchaResponse = getCaptchaResponse;
