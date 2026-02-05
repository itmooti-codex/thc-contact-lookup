// thc-contact-lookup — Model Type Definitions (JSDoc)
// Generated from schema.xml

/**
 * @typedef {Object} Contact
 * @property {number} id
 * @property {string} [email]
 * @property {string} [first_name]
 * @property {string} [last_name]
 * @property {string} [sms_number]
 * @property {string} [address]
 * @property {string} [city]
 * @property {'ACT'|'NSW'|'NT'|'QLD'|'SA'|'TAS'|'VIC'|'WA'} [state_au]
 * @property {string} [zip_code]
 * @property {string} [country]
 * @property {number} [birthday] - unix timestamp
 * @property {number} [age]
 * @property {'Female'|'Intersex'|'Male'|'Prefer not to say'} [sex]
 * @property {string} [profile_image] - image URL
 * @property {'Cancelled'|'External Processing $99'|'Initial Consultation Booked'|'Initial Consultation Paid'|'Intake Form Completed'|'Item Purchased'|'New'|'Quiz Success'|'Script Uploaded'|'Suspended'} [application_status]
 * @property {number} [application_date] - unix timestamp
 * @property {'Application Approved'|'Application Under Review'|'Book a Consult'|'Intake Form Incomplete'|'Payment successful'|'Prescription Created'|'Treatment Live'} [treatment_plan]
 * @property {'Closed - Lost'|'Closed - Won'|'Committed'|'Consideration'|'Demo Scheduled'|'New Prospect'|'Qualified Lead'} [sales_stage]
 * @property {number} [created_at] - unix timestamp
 * @property {number} [last_activity] - unix timestamp
 * @property {string} [scripts_open]
 * @property {string} [scripts_fulfilled]
 * @property {number} [date_first_script] - unix timestamp
 * @property {number} [date_last_script] - unix timestamp
 * @property {number} [date_first_item_purchase] - unix timestamp
 * @property {number} [date_last_item_purchase] - unix timestamp
 * @property {string} [medicare_number]
 * @property {string} [pharmacy_name]
 * @property {'Eligible'|'Ineligible'|'Unkown'} [cannabis_outcome]
 * @property {string} [allergies_information]
 * @property {number} [flower_gms_available]
 * @property {number} [monthly_cannabis_dispense_limit]
 */

/**
 * @typedef {Object} Appointment
 * @property {number} id
 * @property {'Follow Up Consultation'|'Initial Consultation'} [type]
 * @property {'Booked'|'Cancelled'|'Completed'|'Paid'|'Payment Processing'|'Reschedule'|'Script Added'} [status]
 * @property {number} [appointment_time] - unix timestamp
 * @property {number} [date_booked] - unix timestamp
 * @property {boolean} [paid]
 * @property {number} [fee_paid] - currency
 * @property {number} [doctor_id] - FK → Contact
 * @property {number} [patient_id] - FK → Contact
 * @property {string} [patient_comments]
 * @property {boolean} [patient_didn_t_show]
 * @property {string} [conditions]
 * @property {number} [created_at] - unix timestamp
 */

/**
 * @typedef {Object} Script
 * @property {number} id
 * @property {'Archived'|'Cancelled'|'Draft'|'External Processing'|'Fulfilled'|'Open'|'Stock Issue'|'To Be Processed'} [script_status]
 * @property {number} [patient_id] - FK → Contact
 * @property {number} [drug_id] - FK → Item
 * @property {number} [repeats]
 * @property {number} [remaining]
 * @property {number} [supply_limit]
 * @property {number} [dispense_quantity]
 * @property {boolean} [can_dispense]
 * @property {string} [reason_can_t_dispense]
 * @property {number} [next_dispense_date] - unix timestamp
 * @property {number} [valid_until] - unix timestamp
 * @property {string} [dosage_instructions]
 * @property {string} [condition]
 * @property {number} [created_at] - unix timestamp
 */

/**
 * @typedef {Object} Purchase
 * @property {number} id
 * @property {number} [contact_id] - FK → Contact
 * @property {string} [name] - Product name
 * @property {number} [price] - currency
 * @property {number} [quantity]
 * @property {number} [total_purchase] - currency
 * @property {number} [discount] - currency
 * @property {'Collections'|'Declined'|'Paid'|'Pending'|'Refunded'|'Voided'|'Written Off'} [status]
 * @property {'One-time purchase'|'Payment plan'|'Subscription'|'Trial payment'} [type]
 * @property {number} [created_at] - unix timestamp
 */

/**
 * @typedef {Object} Dispense
 * @property {number} id
 * @property {number} [script_id] - FK → Script
 * @property {'Cancelled'|'Confirmed - In Progress'|'Fulfilled'|'In Cart'|'In Transit'|'On Hold'|'Paid'|'Payment Issue'|'Payment Processing'|'Sent -- Awaiting Confirmation'|'Tracking Added'} [dispense_status]
 * @property {number} [quantity]
 * @property {number} [item_retail_price] - currency
 * @property {number} [patient_to_pay_id] - FK → Contact
 * @property {number} [pharmacy_to_dispense_id] - FK → Contact
 * @property {string} [tracking_number]
 * @property {string} [tracking_link] - URL
 * @property {number} [flower_grams]
 * @property {number} [dispense_number_on_script]
 * @property {number} [date_paid] - unix timestamp
 * @property {number} [time_fulfilled] - unix timestamp
 * @property {number} [created_at] - unix timestamp
 */

/** Model metadata for VitalSync SDK queries */
var MODELS = {
  Contact: {
    sdkName: 'ThcContact',
    tableName: 'ThcContact',
    searchFields: ['id', 'email', 'first_name', 'last_name', 'sms_number', 'application_status', 'treatment_plan', 'last_activity', 'profile_image'],
    detailFields: [
      'id', 'email', 'first_name', 'last_name', 'sms_number', 'profile_image',
      'address', 'city', 'state_au', 'zip_code', 'country',
      'birthday', 'age', 'sex',
      'application_status', 'application_date', 'treatment_plan',
      'sales_stage', 'here_about_us',
      'created_at', 'last_activity',
      'scripts_open', 'scripts_fulfilled', 'scripts_archived',
      'date_first_script', 'date_last_script',
      'date_first_item_purchase', 'date_last_item_purchase',
      'medicare_number', 'medicare_name', 'irn', 'ihi_number',
      'pharmacy_name', 'preferred_pharmacy_id',
      'cannabis_outcome', 'allergies_information',
      'flower_gms_available', 'monthly_cannabis_dispense_limit',
    ],
  },
  Appointment: {
    sdkName: 'ThcAppointment',
    tableName: 'ThcAppointment',
    fields: [
      'id', 'type', 'status', 'appointment_time', 'timeslot_start_time',
      'date_booked', 'date_paid', 'paid', 'fee_paid',
      'doctor_id', 'patient_id', 'patient_comments', 'patient_didn_t_show',
      'script_count', 'conditions',
      'doctor_consultation_fee', 'created_at',
    ],
  },
  Script: {
    sdkName: 'ThcScript',
    tableName: 'ThcScript',
    fields: [
      'id', 'script_status', 'doctor_id', 'patient_id', 'drug_id',
      'repeats', 'remaining', 'supply_limit', 'dispense_quantity',
      'can_dispense', 'reason_can_t_dispense', 'next_dispense_date',
      'last_time_dispensed', 'valid_until',
      'dosage_instructions', 'condition', 'treatment_plan',
      'created_at',
    ],
  },
  Purchase: {
    sdkName: 'ThcPurchase',
    tableName: 'ThcPurchase',
    fields: [
      'id', 'contact_id', 'name', 'price', 'quantity',
      'total_purchase', 'discount', 'status', 'type', 'created_at',
    ],
  },
  Dispense: {
    sdkName: 'ThcDispense',
    tableName: 'ThcDispense',
    fields: [
      'id', 'script_id', 'dispense_status', 'quantity',
      'item_retail_price', 'patient_to_pay_id', 'pharmacy_to_dispense_id',
      'tracking_number', 'tracking_link',
      'flower_grams', 'dispense_number_on_script',
      'date_paid', 'time_fulfilled', 'created_at',
    ],
  },
};
