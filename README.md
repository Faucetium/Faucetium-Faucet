# captcha-faucet

# on your vps you must have the following:

  nodejs https://nodejs.org/en/download/package-manager/

  screen https://linuxize.com/post/how-to-use-linux-screen/

# run the following command to install:

  git clone https://github.com/Faucetium/Faucetium-Faucet.git

  npm install

# setup configuration

  copy config-sample.json to config.json

  create a solvemedia account. https://www.solvemedia.com/index.html

  edit config.json and add the following from solvemedia:

  "challengeKey": "",
  "verificationKey": "",
  "authenticationHashKey": ""

# to (optionally) install it with other apps on the same server:

  google "using lighttpd as a reverse proxy".

  set faucet to run on port 8282

  make a dns entry faucet.coin.com

  install lighttpd

  edit /etc/lighttpd/lighttpd.conf

  add the following:

  ```
  $HTTP["host"] =~ "faucet.coin.com" {  
    proxy.server  = ( "" => (  
        "servername:80" => # name  
              ( "host" => "127.0.0.1",  
                      "port" => 8282  
              )  
        )  
    )  
  }  
```


# run the following command to start:

  npm start

# go to this url to see the home page:

  <http://localhost:14004/>

## to run in background, use the command:

  screen -dmSL captcha_faucet npm start;

  screen -x captcha_faucet

## to stop, use the command:

  npm stop

### to do:
