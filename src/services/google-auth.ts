// Uses the same public Firebase project and native Google /auth/google
// exchange as the official iXo site (verified from its public 2026-11-07 JS).
// This is browser-only, never store the Firebase ID token or send it to logs.
const config={
  apiKey:'AIzaSyBkS5V8U1KccGrDGlWgYJ5k2bCJmWCf4o0',
  authDomain:'project-ixo.firebaseapp.com',
  projectId:'project-ixo',
  appId:'1:845644219569:web:f4d8ab413a7a3b22498e90'
};
let sdkPromise:Promise<any>|null=null;
const load=()=>{
  if(sdkPromise)return sdkPromise;
  const appUrl='https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
  const authUrl='https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
  sdkPromise=Promise.all([import(/* @vite-ignore */ appUrl),import(/* @vite-ignore */ authUrl)])
    .then(([app,sdk])=>{
      const instance=app.getApps().find((a:any)=>a.name==='myixo-google')||app.initializeApp(config,'myixo-google');
      let auth;
      try{
        auth=sdk.initializeAuth(instance,{persistence:sdk.inMemoryPersistence,popupRedirectResolver:sdk.browserPopupRedirectResolver});
      }catch(e:any){
        if(e?.code!=='auth/already-initialized')throw e;
        auth=sdk.getAuth(instance);
      }
      return {sdk,auth};
    }).catch((e:any)=>{sdkPromise=null;throw e});
  return sdkPromise;
};

export async function googleAvailability(){
  const response=await fetch('/api/ixo/login?mode=google-availability',{cache:'no-store'});
  if(!response.ok)throw new Error('Google sign-in configuration could not be verified.');
  const result=await response.json();
  return {ready:result.ready===true,reason:!result.provider_enabled?'iXo has Google sign-in disabled.':
    !result.domain_authorized?'This My iXo domain is not authorized in iXo Google authentication.':'Ready'};
}

export async function getGoogleIdentityToken(){
  const {sdk,auth}=await load();
  try{
    const response=await sdk.signInWithPopup(auth,new sdk.GoogleAuthProvider());
    return await response.user.getIdToken();
  }finally{
    // Do not retain a second Firebase client session alongside native iXo.
    await sdk.signOut(auth).catch(()=>{});
  }
}
