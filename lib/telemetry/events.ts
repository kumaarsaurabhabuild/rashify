export const Events = {
  LANDING_VIEW: 'landing_view',
  FORM_FIELD_FOCUS: 'form_field_focus',
  FORM_FIELD_BLUR: 'form_field_blur',
  FORM_SUBMIT_CLICK: 'form_submit_click',
  FORM_SUBMIT_SUCCESS: 'form_submit_success',
  FORM_SUBMIT_FAIL: 'form_submit_fail',

  GEN_PIPELINE_START: 'gen_pipeline_start',
  GEN_GEOCODE_OK: 'gen_geocode_ok',
  GEN_PROKERALA_OK: 'gen_prokerala_ok',
  GEN_LLM_OK: 'gen_llm_ok',
  GEN_PIPELINE_DONE: 'gen_pipeline_done',
  GEN_PIPELINE_FAIL: 'gen_pipeline_fail',

  RESULT_VIEW: 'result_view',
  RESULT_REVEAL_DONE: 'result_reveal_done',
  SHARE_WA_CLICK: 'share_wa_click',
  SHARE_DOWNLOAD_CLICK: 'share_download_click',
  SHARE_COPY_CLICK: 'share_copy_click',
  SHARE_COMPARE_CLICK: 'share_compare_click',

  WA_DELIVERED: 'wa_delivered',
  WA_READ: 'wa_read',
  WA_BUTTON_CLICK: 'wa_button_click',

  VISITOR_ON_SHARED: 'visitor_on_shared',
  VIRAL_SIGNUP: 'viral_signup',
} as const;
export type EventName = (typeof Events)[keyof typeof Events];
