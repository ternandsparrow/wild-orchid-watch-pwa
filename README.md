# Quickstart

  1. clone repo
  1. install deps: `yarn`
  1. run the dev server: `yarn serve`
  1. open the app URL (probably `http://localhost:8080`) in your browser

# Not-so-quick-but-better-start

PWAs *need* to be served over HTTPS for essential features to work. There's an
allowance for localhost to *not* require HTTPS, which is why the quickstart
method above works.  If you want to run the dev server and access it with your
phone, or emulator, then you'll need something in place that provides HTTPS.
Using snakeoil certs doesn't seem to work well (at the very least, Hot Module
Reload sockets won't connect) so the fix is to run a remote SSH tunnel to a
bastion host that has a real SSL cert issued. You can use [this docker-compose
stack](https://github.com/tomsaleeba/docker-https-ssh-tunnel) to achieve that.

  1. start the bastion host from [this repo](https://github.com/tomsaleeba/docker-https-ssh-tunnel)
  1. run the webpack-dev-server for this project, telling it to respond to the DNS associated with the bastion host
      ```bash
      PROXY_HOST=blah.whatever.com yarn serve
      ```
  1. start the remote SSH tunnel to the bastion host (confirm command in the other repo)
      ```bash
      ./start_tunnel.sh 8080 blah.whatever.com
      ```

Now you have a publicly accessible host, with an SSL cert from a trusted CA,
that also has HotModuleReload. Hack away!

# Deploy to Firebase

```bash
npm i -g npx

# Login with the account you used to create the firebase project
npx firebase login

# Build the app
npm run build

# ...and deploy
npx firebase deploy
```

### TODO
  1. make the app stop using the camera when the user can no longer see the
     camera on screen
  1. add install to homescreen button or notification
