import {Game} from '../../../game';
import {createAdhesiveReviewOptions,attachAdhesiveReview} from './review';
const game=new Game(document.querySelector<HTMLElement>('#app')!,createAdhesiveReviewOptions());attachAdhesiveReview(game);game.run();
