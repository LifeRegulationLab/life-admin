import type { Kind, Step, StepType } from '../model/types';
import { newId } from '../store/backend';
import type { PictureName } from './kinds';

/**
 * The steps each kind of thing usually takes, with help for doing each one. They work with no
 * helper and no signal. Anyone can add, remove or rename steps on their own item.
 */

interface StepTemplate {
  type: StepType;
  title: string;
  help: string;
  easyHelp: string;
  /** Roughly how long it usually takes, when it is worth saying. */
  minutes?: number;
}

/** Rough times, so a step can be fitted into a gap in the day. Waiting and going somewhere have none. */
export const USUAL_MINUTES: Record<StepType, number | undefined> = {
  find: 15,
  reply: 20,
  send: 10,
  proof: 5,
  call: 15,
  pay: 10,
  book: 10,
  attend: undefined,
  wait: undefined,
  check: 10,
  custom: undefined,
};

export const STEP_PICTURE: Record<StepType, PictureName> = {
  find: 'find',
  reply: 'write',
  send: 'send',
  proof: 'proof',
  call: 'phone',
  pay: 'pay',
  book: 'calendar',
  attend: 'go',
  wait: 'wait',
  check: 'check',
  custom: 'other',
};

/** The step before a call. Its screen lists what to have ready, taken from the letter. */
export const CALL_READY_TITLE = 'Have things ready for the call';

const T = {
  gather: {
    type: 'find',
    title: 'Get together what they ask for',
    help: 'Find each thing they ask for and put it in one place before you start. If they ask for a copy of a document, a clear photo is usually fine for an online reply. If you cannot find something, write down what is missing; you can still reply and say when you will send it.',
    easyHelp: 'Find the things they ask for. Put them in one place. If something is missing, write it down.',
  },
  reply: {
    type: 'reply',
    title: 'Write the reply',
    help: 'Keep it short. Give their reference near the top, answer what they asked, and say what you are sending with it. You do not have to explain more than they asked for. The draft below can be changed as much as you like.',
    easyHelp: 'Write back. Put their reference at the top. Answer what they asked. Keep it short.',
  },
  send: {
    type: 'send',
    title: 'Send it',
    help: 'Send it the way they asked: online, by email or by post. If you post it, ask the Post Office for a free certificate of posting. Write down the date you sent it.',
    easyHelp: 'Send it the way they asked. Write down the date.',
  },
  proof: {
    type: 'proof',
    title: 'Keep proof you sent it',
    help: 'Keep the confirmation email, the reference number on the screen, a photo of the certificate of posting, or a copy of the email you sent. It is kept here with the letter, so you can find it if they say they did not get it.',
    easyHelp: 'Keep proof. Take a photo, or write down the number they give you.',
  },
  wait: {
    type: 'wait',
    title: 'Wait for them',
    help: 'Nothing more to do until they reply. It moves to Waiting for them, apart from the things you still need to do. Pick a date to chase them if nothing has come by then.',
    easyHelp: 'Now you wait. Pick a day to check back.',
  },
  checkBill: {
    type: 'check',
    title: 'Check the bill is right',
    help: 'Look at the dates it covers, any meter readings, and the amount. Compare with the last bill if you have it. If something looks wrong, ring them before you pay; ask for a breakdown.',
    easyHelp: 'Look at the amount and the dates. Does it look right? If not, ring them first.',
  },
  pay: {
    type: 'pay',
    title: 'Pay it',
    help: 'Pay the way that suits you. If you cannot pay it all, ring them before the date; most will agree a plan. Free help: StepChange 0800 138 1111, National Debtline 0808 808 4000.',
    easyHelp: 'Pay it. If you cannot pay it all, ring them before the date. Free help is on the Help page.',
  },
  keepReceipt: {
    type: 'proof',
    title: 'Keep the receipt',
    help: 'Write down the payment reference or take a picture of the confirmation. It is kept with the bill.',
    easyHelp: 'Keep the receipt. Take a photo or write down the number.',
  },
  formGather: {
    type: 'find',
    title: 'Get the details ready',
    help: 'Most forms ask for the same things: your National Insurance number, dates, addresses, account numbers and any reference on the letter. Put them beside you before you start, so you do not have to stop half way.',
    easyHelp: 'Get your details ready before you start. Numbers, dates, addresses.',
  },
  formFill: {
    type: 'custom',
    title: 'Fill it in, one part at a time',
    minutes: 30,
    help: 'Do one section, then stop if you need to. Write "Where I got to" when you stop, so you know where to start again. If a question does not apply to you, say so rather than leaving it blank.',
    easyHelp: 'Fill in one part. You can stop and come back.',
  },
  formCheck: {
    type: 'check',
    title: 'Check it over',
    help: 'Read it through once. Check the dates, the numbers and that you have signed and dated it where it asks. Take a photo of every page before you send it.',
    easyHelp: 'Read it again. Check you signed it. Take a photo of each page.',
  },
  renewCheck: {
    type: 'check',
    title: 'Check the price and the details',
    help: 'Check the details they hold are still right. For insurance, compare the new price with last year and with one or two other quotes; asking them to match a lower price often works.',
    easyHelp: 'Check the details. Check the price. Is it more than last year?',
  },
  renewDo: {
    type: 'pay',
    title: 'Renew it',
    help: 'Renew it on their website, by phone or by post. Use the official website for anything run by the government, such as car tax or a passport; other sites may charge extra.',
    easyHelp: 'Renew it. Use the official website.',
  },
  book: {
    type: 'book',
    title: 'Book it',
    help: 'Book it online or by ringing them. Put the date and time below; it can go in your calendar and you get a reminder.',
    easyHelp: 'Book it. Put in the date and time.',
  },
  bring: {
    type: 'check',
    title: 'What to take with you',
    help: 'Write down what to take: the letter, any reference, ID, a list of questions. Look at it the day before.',
    easyHelp: 'Write down what to take with you.',
  },
  attend: {
    type: 'attend',
    title: 'Go to it',
    help: 'Check how you will get there and how long it takes. Afterwards, write down what was said and anything you need to do next.',
    easyHelp: 'Go to it. After, write down what they said.',
  },
  callReady: {
    type: 'find',
    title: CALL_READY_TITLE,
    help: 'Have the letter, any reference number, a pen, and your questions in front of you. Calls are often shorter early in the morning.',
    easyHelp: 'Get ready. The letter, the number, a pen.',
  },
  call: {
    type: 'call',
    title: 'Make the call',
    help: 'Use the script below. Ask for the name of the person you speak to, and a reference for the call. Write down what they agree to do and when.',
    easyHelp: 'Ring them. Say what is on the card. Write down their name and what they said.',
  },
  doIt: {
    type: 'custom',
    title: 'Do it',
    help: 'Break it into the smallest first step you can think of, and do just that. You can add more steps.',
    easyHelp: 'Do the first small part.',
  },
} satisfies Record<string, StepTemplate>;

export const TEMPLATES: Record<Kind, StepTemplate[]> = {
  letter: [T.gather, T.reply, T.send, T.proof, T.wait],
  email: [T.gather, T.reply, T.send, T.proof, T.wait],
  form: [T.formGather, T.formFill, T.formCheck, T.send, T.proof, T.wait],
  bill: [T.checkBill, T.pay, T.keepReceipt],
  renewal: [T.renewCheck, T.renewDo, T.keepReceipt],
  appointment: [T.book, T.bring, T.attend],
  call: [T.callReady, T.call, T.wait],
  other: [T.doIt],
};

/** The step added when a reply has not come by the chase date. */
export const CHASE_STEP: StepTemplate = {
  type: 'call',
  title: 'Chase them',
  help: 'Ring or email them. Give your reference, say when you sent it, and ask when you will hear. Write down who you spoke to and what they said.',
  easyHelp: 'Ring them. Say when you sent it. Ask when they will reply.',
};

/** Steps anyone can add to an item. */
export const EXTRA_STEPS: StepTemplate[] = [T.gather, T.reply, T.send, T.proof, T.call, T.pay, T.book, T.attend, T.wait, T.doIt];

export function makeStep(t: StepTemplate): Step {
  const minutes = t.minutes ?? USUAL_MINUTES[t.type];
  return { id: newId(), type: t.type, title: t.title, help: t.help, easyHelp: t.easyHelp, done: false, note: '', ...(minutes ? { minutes } : {}) };
}

export function stepsFor(kind: Kind): Step[] {
  return TEMPLATES[kind].map(makeStep);
}

/** A call script that works with no helper: who you are, the reference, what you need. */
export function callScript(opts: { name: string; reference: string; from: string; ask: string }): string {
  const lines = [
    `Hello, my name is ${opts.name || '[your name]'}.`,
    opts.reference ? `I am ringing about reference ${opts.reference}.` : `I am ringing about a letter from ${opts.from || 'you'}.`,
    opts.ask ? `I need to ${opts.ask.replace(/^to /i, '').replace(/\.$/, '')}.` : 'I would like to check what I need to do.',
    'Could I have your name, please?',
    'Could you give me a reference for this call?',
    'What happens next, and by when?',
  ];
  return lines.join('\n');
}

/** A short reply that works with no helper. */
export function replyDraft(opts: { name: string; address: string; reference: string; from: string; ask: string; today: Date }): string {
  const date = opts.today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return [
    opts.address ? `${opts.name}\n${opts.address}` : opts.name || '[your name]',
    '',
    date,
    '',
    opts.reference ? `Reference: ${opts.reference}` : '',
    '',
    `Dear ${opts.from || 'Sir or Madam'}`,
    '',
    opts.ask ? `Thank you for your letter. You asked me to ${opts.ask.replace(/^to /i, '').replace(/\.$/, '')}. [Write your answer here.]` : 'Thank you for your letter. [Write your answer here.]',
    '',
    '[Say what you are sending with this, if anything.]',
    '',
    'Yours faithfully',
    opts.name || '[your name]',
  ]
    .filter((l, i, all) => !(l === '' && all[i - 1] === ''))
    .join('\n');
}
