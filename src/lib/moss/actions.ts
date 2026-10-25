import { MOSS_TALK, type MossAction } from '../../components/MossCompanion';

/** What Moss can open in Dealt With: the app's own pages, nothing new, and the way to talk to Moss in Mull. */
export const MOSS_ACTIONS: MossAction[] = [
  MOSS_TALK,
  { label: 'Add something', detail: 'A letter, email, form, bill or call', to: '/add' },
  { label: 'Renewals', detail: 'What is coming up for renewal', to: '/renewals' },
  { label: 'Everything', detail: 'All your things, done and not done', to: '/all' },
  { label: 'Free help', detail: 'Citizens Advice, StepChange and others', to: '/help' },
];

export const MOSS_SETTINGS = '/me';
