import type {Game} from '../../../game';
import {createAdhesiveReviewOptions,attachAdhesiveReview} from './review';
export const adhesiveVerificationOptions=createAdhesiveReviewOptions(true);
export function attachAdhesiveVerification(game:Game){attachAdhesiveReview(game,true);}
