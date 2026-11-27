import Page from './Page';

/** moment 以外のページ(about-us・pickup・shop)。page_view・scroll・page_leave のほかには何も送らない。 */
export default class StaticPage extends Page {
  protected override onViewed() {
  }
}
