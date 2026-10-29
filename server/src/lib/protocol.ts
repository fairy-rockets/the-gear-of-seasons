
// draft は ura でだけ見える。omote に出るのは published だけ。
export type MomentStatus = 'draft' | 'published';

export type MomentTier = 'pickup' | 'archive' | 'sketch' | 'hidden';

export namespace Moment {
  export namespace Save {
    export type Request = {
      title: string;
      originalDate: string | null;
      date: string | null;
      author: string;
      text: string;
      status: MomentStatus;
      tier: MomentTier;
      series: string[];
      // null なら本文と注釈から計算した値（自動）。true / false なら手での上書き。
      sensitiveOverride: boolean | null;
    };
    export type Response = {
      path: string;
      date: string;
      status: MomentStatus;
      sensitive: boolean;
      sensitiveManual: boolean;
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
