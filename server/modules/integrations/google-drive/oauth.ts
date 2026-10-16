import { OAuth2Client, CodeChallengeMethod, type Credentials } from 'google-auth-library';
import { GoogleDriveAdapter } from './adapter.js';
import { DRIVE_FILE_SCOPE, googleDriveConfig, type GoogleDriveConfig } from './config.js';
import { DriveIntegrationError, safeDriveError } from './errors.js';
import type { DriveStorageProvider, ProjectDriveStorageProvider } from './provider.js';

export interface DriveOAuthGateway {
  authorization(state:string):Promise<{url:string;verifier:string}>;
  exchange(code:string,verifier:string):Promise<Credentials>;
  verifyScopes(tokens:Credentials):Promise<void>;
  storage(credentials:Credentials):DriveStorageProvider;
  revoke(refreshToken:string):Promise<void>;
}
export class GoogleDriveOAuth implements DriveOAuthGateway {
  constructor(private config:GoogleDriveConfig=googleDriveConfig()){}
  private client() {
    const client=new OAuth2Client({clientId:this.config.clientId,clientSecret:this.config.clientSecret,redirectUri:this.config.redirectUri});
    client.transporter.defaults={...client.transporter.defaults,timeout:15000,retry:false};return client;
  }
  async authorization(state:string) {
    const client=this.client(),pkce=await client.generateCodeVerifierAsync();
    if(!pkce.codeChallenge)throw new DriveIntegrationError('OAUTH_FAILED',502);
    return {url:client.generateAuthUrl({access_type:'offline',prompt:'consent',scope:[DRIVE_FILE_SCOPE],include_granted_scopes:false,state,code_challenge:pkce.codeChallenge,code_challenge_method:CodeChallengeMethod.S256}),verifier:pkce.codeVerifier};
  }
  async exchange(code:string,verifier:string) {try{return (await this.client().getToken({code,codeVerifier:verifier,redirect_uri:this.config.redirectUri})).tokens;}catch(e){throw safeDriveError(e);}}
  async verifyScopes(tokens:Credentials) {
    if(!tokens.access_token)throw new DriveIntegrationError('INVALID_RESPONSE',502);
    try {
      const scopes=tokens.scope?tokens.scope.split(/\s+/).filter(Boolean):(await this.client().getTokenInfo(tokens.access_token)).scopes;
      if(scopes.length!==1||scopes[0]!==DRIVE_FILE_SCOPE)throw new DriveIntegrationError('SCOPE_MISMATCH',403);
    }catch(e){throw safeDriveError(e);}
  }
  storage(credentials:Credentials):DriveStorageProvider {const client=this.client();client.setCredentials(credentials);return new GoogleDriveAdapter(client);}
  workspaceStorage(credentials:Credentials):ProjectDriveStorageProvider {const client=this.client();client.setCredentials(credentials);return new GoogleDriveAdapter(client);}
  async revoke(refreshToken:string) {try{await this.client().revokeToken(refreshToken);}catch(e){throw safeDriveError(e);}}
}
