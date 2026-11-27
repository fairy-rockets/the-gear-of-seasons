import Page from './Page';
import * as analytics from '../Analytics';

/** moment のページ。見せ始めたら、その moment を view_item で送る。 */
export default class MomentPage extends Page {
  protected override onViewed(via: analytics.NavVia) {
    const title = this.contentTitle;
    if(title !== null) {
      analytics.viewMoment({ path: this.path, title }, via);
    }
  }
}
