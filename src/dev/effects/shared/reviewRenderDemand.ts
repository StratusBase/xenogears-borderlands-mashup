/** Frozen review frames retain their pixels; live gameplay and capture always draw. */
export class ReviewRenderDemand {
 private dirty=true;private draws=0;private idle=0;
 invalidate(){this.dirty=true;}
 admit(live:boolean){if(!live&&!this.dirty){this.idle++;return false;}this.dirty=false;this.draws++;return true;}
 get diagnostics(){return{draws:this.draws,idleCallbacks:this.idle,pending:this.dirty};}
}
