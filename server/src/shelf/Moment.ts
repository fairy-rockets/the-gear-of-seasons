import dayjs from "dayjs";

type Moment = {
  timestamp: dayjs.Dayjs;
  title: string;
  author: string;
  text: string;
};

export const kMomentTimeFormat = 'YYYY/MM/DD HH:mm:ss';
export const kMomentPathFormat = '/YYYY/MM/DD/HH:mm:ss/';

export default Moment;
