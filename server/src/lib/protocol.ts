
// draft は ura でだけ見える。omote に出るのは published だけ。
export type MomentStatus = 'draft' | 'published';

export namespace Moment {
  export namespace Save {
    export type Request = {
      title: string;
      originalDate: string | null;
      date: string | null;
      author: string;
      text: string;
      status: MomentStatus;
    };
    export type Response = {
      path: string;
      date: string;
      status: MomentStatus;
      body: string;
    };
  }
  export namespace Search {
    export type Response = {
      angle: number;
      date: string;
      title: string;
      path: string;
      imageURL: string;
      bodyURL: string;
    };
  }
  export namespace Delete {
    export type Request = {
      date: string;
    };
    export type Response = {
      year: string;
    };
  }
}
