/** Where to send the browser to sign in with Google, and the secrets to keep in a cookie until it comes back. */
export interface GoogleFlowStart {
  location: string;
  flow: string;
}
