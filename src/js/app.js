// thc-contact-lookup — Main Application
(function () {
  'use strict';

  var u = window.AppUtils;
  var plugin = null;
  var contacts = [];
  var currentContact = null;

  // Fields for search results table (subset of full model)
  var SEARCH_FIELDS = ['id', 'email', 'first_name', 'last_name', 'sms_number', 'application_status'];

  // Subscription state
  var contactSub = null;
  var contactQuery = null;

  document.addEventListener('DOMContentLoaded', function () {
    init();
  });

  function init() {
    window.VitalSync.connect()
      .then(function (p) {
        plugin = p;
        u.byId('app-loading').classList.add('hidden');
        u.byId('app-content').classList.remove('hidden');
        u.byId('searchInput').focus();

        // Wire up search
        u.byId('searchBtn').addEventListener('click', searchContacts);
        u.byId('searchInput').addEventListener('keypress', function (e) {
          if (e.key === 'Enter') searchContacts();
        });
        u.byId('resetBtn').addEventListener('click', resetSearch);

        // Load dashboard chart (all appointments)
        loadDashboardChart();
      })
      .catch(function (err) {
        u.byId('app-loading').classList.add('hidden');
        u.byId('app-error').classList.remove('hidden');
        console.error('App init failed:', err);
      });
  }

  // ── Search ────────────────────────────────────────────────────

  function searchContacts() {
    var term = u.byId('searchInput').value.trim();
    if (!term) { u.showToast('Enter a search term', 'warning'); return; }

    var btn = u.byId('searchBtn');
    btn.disabled = true;
    btn.textContent = 'Searching...';
    u.byId('resultsTable').classList.add('hidden');
    u.byId('noResults').classList.add('hidden');
    u.byId('resultCount').textContent = '';

    var searchTerm = '%' + term + '%';

    plugin
      .switchTo(MODELS.Contact.sdkName)
      .query()
      .select(SEARCH_FIELDS)
      .where('email', 'like', searchTerm)
      .orWhere('first_name', 'like', searchTerm)
      .orWhere('last_name', 'like', searchTerm)
      .orWhere('sms_number', 'like', searchTerm)
      .limit(100)
      .fetchAllRecords()
      .pipe(window.toMainInstance(true))
      .toPromise()
      .then(function (records) {
        contacts = records ? Object.values(records) : [];
        if (contacts.length === 0) {
          u.byId('noResults').classList.remove('hidden');
        } else {
          renderResults(contacts);
        }
      })
      .catch(function (err) {
        u.showToast('Search failed: ' + err.message, 'error');
        console.error('Search error:', err);
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Search';
        u.byId('resetBtn').classList.remove('hidden');
      });
  }

  function resetSearch() {
    u.byId('searchInput').value = '';
    u.byId('resultCount').textContent = '';
    u.byId('resultsTable').classList.add('hidden');
    u.byId('noResults').classList.add('hidden');
    u.byId('resetBtn').classList.add('hidden');
    contacts = [];
    u.byId('searchInput').focus();
  }

  function renderResults(list) {
    u.byId('resultCount').textContent = list.length + ' result' + (list.length !== 1 ? 's' : '');
    var tbody = u.byId('resultsBody');
    tbody.innerHTML = '';

    list.forEach(function (c, i) {
      var name = ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || 'N/A';
      var tr = document.createElement('tr');
      tr.className = 'cursor-pointer hover:bg-gray-50 transition-colors';
      tr.onclick = function () { selectContact(i); };
      tr.innerHTML =
        '<td class="px-4 py-3 font-medium text-gray-900">' + u.escapeHtml(name) + '</td>' +
        '<td class="px-4 py-3 text-gray-600">' + u.escapeHtml(c.email || 'N/A') + '</td>' +
        '<td class="px-4 py-3 text-gray-600">' + u.escapeHtml(c.sms_number || 'N/A') + '</td>' +
        '<td class="px-4 py-3">' + statusBadge(c.application_status) + '</td>' +
        '<td class="px-4 py-3 text-gray-500 text-sm">' + u.formatDate(c.last_activity) + '</td>';
      tbody.appendChild(tr);
    });

    u.byId('resultsTable').classList.remove('hidden');
  }

  // ── Select Contact ────────────────────────────────────────────

  function selectContact(index) {
    var c = contacts[index];
    if (!c) return;

    cleanupSubscriptions();
    currentContact = null;

    // Switch views
    u.byId('searchView').classList.add('hidden');
    u.byId('detailView').classList.remove('hidden');

    // Show loading in detail
    u.byId('detailLoading').classList.remove('hidden');
    u.byId('detailContent').classList.add('hidden');

    // Fetch full contact details
    plugin
      .switchTo(MODELS.Contact.sdkName)
      .query()
      .select(MODELS.Contact.detailFields)
      .where('id', '=', c.id)
      .limit(1)
      .fetchAllRecords()
      .pipe(window.toMainInstance(true))
      .toPromise()
      .then(function (records) {
        var list = records ? Object.values(records) : [];
        if (list.length === 0) {
          u.showToast('Contact not found', 'error');
          backToSearch();
          return;
        }
        currentContact = list[0];
        renderContactDetail(currentContact);
        u.byId('detailLoading').classList.add('hidden');
        u.byId('detailContent').classList.remove('hidden');

        // Set up subscription
        subscribeToContact(currentContact.id);

        // Load related data in parallel
        loadAppointments(currentContact.id);
        loadScripts(currentContact.id);
        loadPurchases(currentContact.id);
        loadDispenses(currentContact.id);
      })
      .catch(function (err) {
        u.showToast('Failed to load contact: ' + err.message, 'error');
        console.error(err);
        backToSearch();
      });
  }

  function backToSearch() {
    cleanupSubscriptions();
    currentContact = null;
    u.byId('detailView').classList.add('hidden');
    u.byId('searchView').classList.remove('hidden');
  }

  // ── Edit Contact ─────────────────────────────────────────────

  function openEditModal() {
    if (!currentContact) return;
    u.byId('editFirstName').value = currentContact.first_name || '';
    u.byId('editLastName').value = currentContact.last_name || '';
    u.byId('editEmail').value = currentContact.email || '';
    u.byId('editSms').value = currentContact.sms_number || '';
    u.byId('editModal').classList.remove('hidden');
  }

  function closeEditModal() {
    u.byId('editModal').classList.add('hidden');
  }

  function saveContact() {
    if (!currentContact || !plugin) return;

    var updates = {
      first_name: u.byId('editFirstName').value.trim(),
      last_name: u.byId('editLastName').value.trim(),
      email: u.byId('editEmail').value.trim(),
      sms_number: u.byId('editSms').value.trim(),
    };

    var btn = u.byId('editSaveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    var contactId = currentContact.id;
    var mutation = plugin.switchTo(MODELS.Contact.sdkName).mutation();
    mutation.update(function (q) {
      return q.where('id', contactId).set(updates);
    });

    mutation.execute(true).toPromise()
      .then(function () {
        currentContact = Object.assign({}, currentContact, updates);
        renderContactDetail(currentContact);
        closeEditModal();
        u.showToast('Contact saved', 'success');
        // Re-establish subscription — mutation can disrupt the active subscription
        cleanupSubscriptions();
        subscribeToContact(currentContact.id);
      })
      .catch(function (err) {
        u.showToast('Save failed: ' + err.message, 'error');
        console.error('Save error:', err);
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Save';
      });
  }

  // Expose for onclick in HTML
  window.backToSearch = backToSearch;
  window.openEditModal = openEditModal;
  window.closeEditModal = closeEditModal;
  window.saveContact = saveContact;

  // ── Render Contact Detail ─────────────────────────────────────

  function renderContactDetail(c) {
    var name = ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || 'Unknown';
    var ontraportUrl = 'https://app.ontraport.com/#!/contact/edit&id=' + c.id;

    // Header
    u.byId('contactName').innerHTML = '<a href="' + ontraportUrl + '" target="_blank" rel="noopener" class="hover:opacity-70 transition-opacity">' + u.escapeHtml(name) + ' &#8599;</a>';
    u.byId('contactEmail').textContent = c.email || '';

    // Address
    var parts = [c.address, c.city, c.state_au || c.state, c.zip_code].filter(Boolean);
    var fullAddress = parts.join(', ');
    var mapsUrl = fullAddress ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(fullAddress) : '';

    // Application card
    u.byId('cardApplication').innerHTML =
      detailRow('Status', appStatusBadge(c.application_status)) +
      detailRow('Treatment Plan', statusBadge(c.treatment_plan, 'blue')) +
      detailRow('Cannabis Eligibility', statusBadge(c.cannabis_outcome, c.cannabis_outcome === 'Eligible' ? 'green' : 'red')) +
      detailRow('Date Applied', u.formatDate(c.application_date)) +
      detailRow('Terms Signed', c.terms_conditions ? boolBadge(true, 'Yes') : boolBadge(false, 'No')) +
      detailRow('Tobacco Smoker', c.tobacco_smoker || 'N/A') +
      detailRow('Using Other Clinic', c.using_other_clinic || 'N/A') +
      detailRow('Previous Cannabis Use', c.prev_cannabis_use ? 'Yes' : 'No');

    // Contact card
    var phoneHtml = c.sms_number ? '<a href="tel:' + c.sms_number + '" class="text-blue-600 hover:underline">' + u.escapeHtml(c.sms_number) + '</a>' : 'N/A';
    var emailHtml = c.email ? '<a href="mailto:' + c.email + '" class="text-blue-600 hover:underline">' + u.escapeHtml(c.email) + '</a>' : 'N/A';
    u.byId('cardContact').innerHTML =
      detailRow('Phone', phoneHtml) +
      detailRow('Email', emailHtml) +
      detailRow('Sex', c.sex || 'N/A') +
      detailRow('Age', c.age || 'N/A') +
      detailRow('Birthday', u.formatDate(c.birthday));

    // Address card
    u.byId('cardAddress').innerHTML =
      detailRow('Address', mapsUrl ? '<a href="' + mapsUrl + '" target="_blank" class="text-blue-600 hover:underline">' + u.escapeHtml(fullAddress) + ' &#8599;</a>' : 'N/A');

    // Contraindications card
    var contraindications = [
      { key: 'i_have_an_allergy_to_cannabinoids', label: 'Allergy to cannabinoids' },
      { key: 'i_suffer_from_chronic_liver_disease', label: 'Chronic liver disease' },
      { key: 'i_am_currently_pregnant_or_breastfeeding', label: 'Pregnant or breastfeeding' },
      { key: 'i_have_a_history_of_suicidal_ideations_and_or_self_harm', label: 'History of suicidal ideation / self-harm' },
      { key: 'i_have_a_history_of_schizophrenia_bipolar_and_or_psychosis', label: 'History of schizophrenia / bipolar / psychosis' },
      { key: 'history_of_opioid_replacement_therapy_and_or_drug_dependency', label: 'Opioid replacement / drug dependency' },
    ];
    var activeContras = contraindications.filter(function (ci) { return c[ci.key]; });
    if (c.none_of_these_apply_to_me || activeContras.length === 0) {
      u.byId('cardContraindications').innerHTML =
        '<div class="flex items-center gap-2 py-2"><span class="inline-block w-2 h-2 rounded-full bg-green-500"></span><span class="text-sm text-green-700">No contraindications reported</span></div>';
    } else {
      u.byId('cardContraindications').innerHTML = activeContras.map(function (ci) {
        return '<div class="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">' +
          '<span class="inline-block w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>' +
          '<span class="text-sm text-red-700">' + ci.label + '</span></div>';
      }).join('');
    }

    // Existing conditions card
    var conditions = [
      { key: 'adhd', label: 'ADHD' }, { key: 'ptsd', label: 'PTSD' },
      { key: 'cancer', label: 'Cancer' }, { key: 'epilepsy', label: 'Epilepsy' },
      { key: 'glaucoma', label: 'Glaucoma' }, { key: 'arthritis', label: 'Arthritis' },
      { key: 'headaches', label: 'Headaches' }, { key: 'migraines', label: 'Migraines' },
      { key: 'depression', label: 'Depression' }, { key: 'fibromyalgia', label: 'Fibromyalgia' },
      { key: 'inflammation', label: 'Inflammation' }, { key: 'endometriosis', label: 'Endometriosis' },
      { key: 'sleep_disorder', label: 'Sleep Disorder' }, { key: 'chronic_illness', label: 'Chronic Illness' },
      { key: 'palliative_care', label: 'Palliative Care' }, { key: 'anxiety_disorder', label: 'Anxiety Disorder' },
      { key: 'loss_of_appetite', label: 'Loss of Appetite' }, { key: 'neuropathic_pain', label: 'Neuropathic Pain' },
      { key: 'multiple_sclerosis', label: 'Multiple Sclerosis' }, { key: 'parkinson_s_disease', label: "Parkinson's Disease" },
      { key: 'chronic_non_cancer_pain', label: 'Chronic Non-Cancer Pain' },
      { key: 'autism_spectrum_disorder', label: 'Autism Spectrum Disorder' },
      { key: 'crohns_ulcerative_colitis_ibs_gut', label: "Crohn's / Colitis / IBS" },
      { key: 'chemotherapy_induced_nausea_and_vomiting', label: 'Chemo-Induced Nausea/Vomiting' },
    ];
    var activeConditions = conditions.filter(function (cd) { return c[cd.key]; });
    var conditionsHtml = '';
    if (activeConditions.length > 0) {
      conditionsHtml = '<div class="flex flex-wrap gap-1.5 mb-2">' +
        activeConditions.map(function (cd) {
          return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">' + cd.label + '</span>';
        }).join('') + '</div>';
    } else {
      conditionsHtml = '<p class="text-sm text-gray-400 py-1">None reported</p>';
    }
    if (c.other_condition) {
      conditionsHtml += detailRow('Other', u.escapeHtml(c.other_condition));
    }
    if (c.allergies_information) {
      conditionsHtml += detailRow('Allergies', u.escapeHtml(c.allergies_information));
    }
    u.byId('cardConditions').innerHTML = conditionsHtml;

    // Medications card
    var medsHtml = detailRow('Taking Medications?', c.are_you_currently_taking_any_medications_or_supplements || 'N/A');
    if (c.list_your_medications_supplements) {
      medsHtml += longTextRow('Current Medications', c.list_your_medications_supplements);
    }
    if (c.what_is_working_for_you) {
      medsHtml += longTextRow("What's Working", c.what_is_working_for_you);
    }
    if (c.why_regular_medicine_isn_t_working) {
      medsHtml += longTextRow("Why Regular Medicine Isn't Working", c.why_regular_medicine_isn_t_working);
    }
    u.byId('cardMedications').innerHTML = medsHtml;

    // Medical IDs card
    u.byId('cardMedical').innerHTML =
      detailRow('Medicare', c.medicare_number || 'N/A') +
      detailRow('Medicare Name', c.medicare_name || 'N/A') +
      detailRow('IRN', c.irn || 'N/A') +
      detailRow('IHI', c.ihi_number || 'N/A') +
      detailRow('Veteran Card', c.veteran_healthcare_card_holder ? boolBadge(true, 'Yes') : 'No') +
      detailRow('Pharmacy', c.pharmacy_name || 'N/A') +
      detailRow('Flower Limit', (c.monthly_cannabis_dispense_limit || '—') + 'g/month') +
      detailRow('Flower Available', (c.flower_gms_available || '—') + 'g') +
      (c.flower_limit_reached ? detailRow('Limit Reached', boolBadge(true, 'YES', 'red')) : '');

    // AI / Nurse Evaluation card
    var aiHtml = detailRow('Cannabis Outcome', statusBadge(c.cannabis_outcome, c.cannabis_outcome === 'Eligible' ? 'green' : c.cannabis_outcome === 'Ineligible' ? 'red' : '')) +
      detailRow('AI Consultation', c.ai_consultation ? boolBadge(true, 'Complete') : 'Not done') +
      detailRow('Consultation Date', u.formatDate(c.date_ai_consulation));
    if (c.ai_notes) {
      aiHtml += htmlContentRow('AI Notes', c.ai_notes);
    }
    u.byId('cardAI').innerHTML = aiHtml;

    // Eligibility Quiz card
    var quizHtml = '';
    if (c.treatment_outcome) quizHtml += longTextRow('Treatment Outcome', c.treatment_outcome);
    if (c.previous_treatment) quizHtml += longTextRow('Previous Treatment', c.previous_treatment);
    if (c.long_term_condition) quizHtml += longTextRow('Long Term Condition', c.long_term_condition);
    if (c.mental_health_history) quizHtml += longTextRow('Mental Health History', c.mental_health_history);
    if (c.pregnancy_or_fertility) quizHtml += longTextRow('Pregnancy / Fertility', c.pregnancy_or_fertility);
    u.byId('cardQuiz').innerHTML = quizHtml || '<p class="text-sm text-gray-400 py-1">No quiz data</p>';

    // Scripts summary
    u.byId('cardScripts').innerHTML =
      detailRow('Open Scripts', c.scripts_open || '0') +
      detailRow('Fulfilled', c.scripts_fulfilled || '0') +
      detailRow('Archived', c.scripts_archived || '0') +
      detailRow('First Script', u.formatDate(c.date_first_script)) +
      detailRow('Last Script', u.formatDate(c.date_last_script));

    // Purchases summary
    u.byId('cardPurchases').innerHTML =
      detailRow('First Purchase', u.formatDate(c.date_first_item_purchase)) +
      detailRow('Last Purchase', u.formatDate(c.date_last_item_purchase));
  }

  function detailRow(label, value) {
    return '<div class="flex justify-between py-1.5 border-b border-gray-100 last:border-0">' +
      '<span class="text-sm text-gray-500">' + label + '</span>' +
      '<span class="text-sm text-gray-900 text-right">' + (value || 'N/A') + '</span>' +
      '</div>';
  }

  // ── Dashboard Chart ──────────────────────────────────────────

  var appointmentsChart = null;

  function loadDashboardChart() {
    plugin
      .switchTo(MODELS.Appointment.sdkName)
      .query()
      .select(['id', 'appointment_time', 'total_retail_revenue', 'status'])
      .limit(500)
      .fetchAllRecords()
      .pipe(window.toMainInstance(true))
      .toPromise()
      .then(function (records) {
        var items = records ? Object.values(records) : [];
        if (items.length === 0) {
          u.byId('chartLoading').classList.add('hidden');
          u.byId('chartEmpty').classList.remove('hidden');
          return;
        }
        renderAppointmentsChart(items);
      })
      .catch(function (err) {
        console.error('Dashboard chart failed:', err);
        u.byId('chartLoading').classList.add('hidden');
        u.byId('chartEmpty').classList.remove('hidden');
      });
  }

  // ── Load Related Data ─────────────────────────────────────────

  function loadAppointments(contactId) {
    var container = u.byId('appointmentsList');
    container.innerHTML = '<p class="text-sm text-gray-400 py-4">Loading appointments...</p>';

    plugin
      .switchTo(MODELS.Appointment.sdkName)
      .query()
      .select(MODELS.Appointment.fields)
      .where('patient_id', '=', contactId)
      .limit(50)
      .fetchAllRecords()
      .pipe(window.toMainInstance(true))
      .toPromise()
      .then(function (records) {
        var items = records ? Object.values(records) : [];
        if (items.length === 0) {
          container.innerHTML = '<p class="text-sm text-gray-400 py-4 text-center">No appointments found</p>';
          return;
        }
        // Sort by appointment_time descending
        items.sort(function (a, b) { return (b.appointment_time || 0) - (a.appointment_time || 0); });
        container.innerHTML = items.map(function (a) {
          return '<div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">' +
            '<div>' +
            '<div class="text-sm font-medium text-gray-900">' + u.escapeHtml(a.type || 'Appointment') + '</div>' +
            '<div class="text-xs text-gray-500">' + u.formatDate(a.appointment_time) + '</div>' +
            '</div>' +
            '<div class="flex items-center gap-3">' +
            (a.fee_paid ? '<span class="text-sm text-gray-600">' + u.formatCurrency(a.fee_paid) + '</span>' : '') +
            statusBadge(a.status) +
            '</div>' +
            '</div>';
        }).join('');
        u.byId('appointmentsCount').textContent = '(' + items.length + ')';
      })
      .catch(function (err) {
        container.innerHTML = '<p class="text-sm text-red-500 py-4">Failed to load: ' + u.escapeHtml(err.message) + '</p>';
      });
  }

  function renderAppointmentsChart(appointments) {
    u.byId('chartLoading').classList.add('hidden');

    // Filter to appointments with a valid time
    var valid = appointments.filter(function (a) { return a.appointment_time; });
    if (valid.length === 0) {
      u.byId('chartEmpty').classList.remove('hidden');
      return;
    }

    // Group by ISO week (Mon–Sun)
    // Appointments count: only 'Completed' status
    // Revenue: all appointments (unfiltered)
    var weekData = {};
    valid.forEach(function (a) {
      var d = new Date(a.appointment_time * 1000);
      var weekStart = getWeekStart(d);
      var key = weekStart.toISOString().slice(0, 10);
      if (!weekData[key]) {
        weekData[key] = { count: 0, revenue: 0 };
      }
      if (a.status === 'Completed') {
        weekData[key].count += 1;
      }
      weekData[key].revenue += parseFloat(a.total_retail_revenue) || 0;
    });

    // Sort weeks chronologically
    var weeks = Object.keys(weekData).sort();
    var labels = weeks.map(function (w) {
      var d = new Date(w + 'T00:00:00');
      return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    });
    var counts = weeks.map(function (w) { return weekData[w].count; });
    var revenues = weeks.map(function (w) { return weekData[w].revenue; });

    // Destroy old chart if exists
    if (appointmentsChart) {
      appointmentsChart.destroy();
    }

    u.byId('chartContainer').classList.remove('hidden');
    var ctx = u.byId('appointmentsChart').getContext('2d');

    appointmentsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Appointments',
            data: counts,
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1,
            yAxisID: 'y',
            order: 2,
          },
          {
            label: 'Revenue ($)',
            data: revenues,
            type: 'line',
            borderColor: 'rgb(16, 185, 129)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: 'rgb(16, 185, 129)',
            fill: true,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, padding: 16 } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                if (ctx.dataset.yAxisID === 'y1') {
                  return ctx.dataset.label + ': $' + ctx.parsed.y.toFixed(2);
                }
                return ctx.dataset.label + ': ' + ctx.parsed.y;
              },
            },
          },
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Appointments', color: 'rgb(59, 130, 246)' },
            ticks: { precision: 0 },
            beginAtZero: true,
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Revenue ($)', color: 'rgb(16, 185, 129)' },
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: {
              callback: function (val) { return '$' + val.toLocaleString(); },
            },
          },
        },
      },
    });
  }

  /** Get Monday of the week for a given date */
  function getWeekStart(date) {
    var d = new Date(date);
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function loadScripts(contactId) {
    var container = u.byId('scriptsList');
    container.innerHTML = '<p class="text-sm text-gray-400 py-4">Loading scripts...</p>';

    plugin
      .switchTo(MODELS.Script.sdkName)
      .query()
      .select(MODELS.Script.fields)
      .where('patient_id', '=', contactId)
      .limit(50)
      .fetchAllRecords()
      .pipe(window.toMainInstance(true))
      .toPromise()
      .then(function (records) {
        var items = records ? Object.values(records) : [];
        if (items.length === 0) {
          container.innerHTML = '<p class="text-sm text-gray-400 py-4 text-center">No scripts found</p>';
          return;
        }
        items.sort(function (a, b) { return (b.created_at || 0) - (a.created_at || 0); });
        container.innerHTML = items.map(function (s) {
          var remaining = s.remaining != null ? s.remaining + '/' + (s.supply_limit || '?') + ' remaining' : '';
          return '<div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">' +
            '<div>' +
            '<div class="text-sm font-medium text-gray-900">' + u.escapeHtml(s.condition || 'Script #' + s.id) + '</div>' +
            '<div class="text-xs text-gray-500">' + u.formatDate(s.created_at) +
            (remaining ? ' &middot; ' + remaining : '') +
            (s.next_dispense_date ? ' &middot; Next: ' + u.formatDate(s.next_dispense_date) : '') +
            '</div>' +
            (s.dosage_instructions ? '<div class="text-xs text-gray-400 mt-0.5 truncate max-w-xs">' + u.escapeHtml(s.dosage_instructions) + '</div>' : '') +
            '</div>' +
            '<div class="flex items-center gap-2">' +
            (s.can_dispense ? '<span class="inline-block w-2 h-2 rounded-full bg-green-500" title="Can dispense"></span>' : '') +
            scriptStatusBadge(s.script_status) +
            '</div>' +
            '</div>';
        }).join('');
        u.byId('scriptsCount').textContent = '(' + items.length + ')';
      })
      .catch(function (err) {
        container.innerHTML = '<p class="text-sm text-red-500 py-4">Failed to load: ' + u.escapeHtml(err.message) + '</p>';
      });
  }

  function loadPurchases(contactId) {
    var container = u.byId('purchasesList');
    container.innerHTML = '<p class="text-sm text-gray-400 py-4">Loading purchases...</p>';

    plugin
      .switchTo(MODELS.Purchase.sdkName)
      .query()
      .select(MODELS.Purchase.fields)
      .where('contact_id', '=', contactId)
      .limit(50)
      .fetchAllRecords()
      .pipe(window.toMainInstance(true))
      .toPromise()
      .then(function (records) {
        var items = records ? Object.values(records) : [];
        if (items.length === 0) {
          container.innerHTML = '<p class="text-sm text-gray-400 py-4 text-center">No purchases found</p>';
          return;
        }

        // Collect unique product IDs to resolve internal names
        var productIds = [];
        items.forEach(function (p) {
          if (p.product_id && productIds.indexOf(p.product_id) === -1) {
            productIds.push(p.product_id);
          }
        });

        // Fetch product internal names, then render
        var productNamePromise = productIds.length > 0
          ? plugin
              .switchTo(MODELS.Product.sdkName)
              .query()
              .select(['id', 'internal_name', 'public_name'])
              .where('id', 'in', productIds)
              .fetchAllRecords()
              .pipe(window.toMainInstance(true))
              .toPromise()
          : Promise.resolve(null);

        return productNamePromise.then(function (productRecords) {
          // Build product ID → internal name map
          var productNames = {};
          if (productRecords) {
            Object.values(productRecords).forEach(function (prod) {
              productNames[prod.id] = prod.internal_name || prod.public_name || '';
            });
          }

          items.sort(function (a, b) { return (b.created_at || 0) - (a.created_at || 0); });
          container.innerHTML = items.map(function (p) {
            var displayName = (p.product_id && productNames[p.product_id]) || p.name || 'Purchase #' + p.id;
            return '<div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">' +
              '<div>' +
              '<div class="text-sm font-medium text-gray-900">' + u.escapeHtml(displayName) + '</div>' +
              '<div class="text-xs text-gray-500">' + u.formatDate(p.created_at) +
              (p.quantity > 1 ? ' &middot; Qty: ' + p.quantity : '') +
              '</div>' +
              '</div>' +
              '<div class="flex items-center gap-3">' +
              '<span class="text-sm font-semibold text-gray-900">' + u.formatCurrency(p.total_purchase || p.price) + '</span>' +
              purchaseStatusBadge(p.status) +
              '</div>' +
              '</div>';
          }).join('');
          u.byId('purchasesCount').textContent = '(' + items.length + ')';

          // Total revenue — only include Paid purchases
          var total = items.reduce(function (sum, p) {
            return p.status === 'Paid' ? sum + (p.total_purchase || p.price || 0) : sum;
          }, 0);
          u.byId('purchasesTotal').textContent = 'Total (Paid): ' + u.formatCurrency(total);
        });
      })
      .catch(function (err) {
        container.innerHTML = '<p class="text-sm text-red-500 py-4">Failed to load: ' + u.escapeHtml(err.message) + '</p>';
      });
  }

  function loadDispenses(contactId) {
    var container = u.byId('dispensesList');
    container.innerHTML = '<p class="text-sm text-gray-400 py-4">Loading dispenses...</p>';

    plugin
      .switchTo(MODELS.Dispense.sdkName)
      .query()
      .select(MODELS.Dispense.fields)
      .where('patient_to_pay_id', '=', contactId)
      .limit(50)
      .fetchAllRecords()
      .pipe(window.toMainInstance(true))
      .toPromise()
      .then(function (records) {
        var items = records ? Object.values(records) : [];
        if (items.length === 0) {
          container.innerHTML = '<p class="text-sm text-gray-400 py-4 text-center">No dispenses found</p>';
          return;
        }
        items.sort(function (a, b) { return (b.created_at || 0) - (a.created_at || 0); });
        container.innerHTML = items.map(function (d) {
          var trackHtml = d.tracking_link ? '<a href="' + d.tracking_link + '" target="_blank" class="text-xs text-blue-600 hover:underline">Track &#8599;</a>' : '';
          return '<div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">' +
            '<div>' +
            '<div class="text-sm font-medium text-gray-900">Dispense #' + d.id +
            (d.flower_grams ? ' &middot; ' + d.flower_grams + 'g' : '') +
            (d.quantity ? ' &middot; Qty ' + d.quantity : '') +
            '</div>' +
            '<div class="text-xs text-gray-500">' + u.formatDate(d.created_at) +
            (d.tracking_number ? ' &middot; ' + u.escapeHtml(d.tracking_number) : '') +
            '</div>' +
            '</div>' +
            '<div class="flex items-center gap-3">' +
            trackHtml +
            (d.item_retail_price ? '<span class="text-sm text-gray-600">' + u.formatCurrency(d.item_retail_price) + '</span>' : '') +
            dispenseStatusBadge(d.dispense_status) +
            '</div>' +
            '</div>';
        }).join('');
        u.byId('dispensesCount').textContent = '(' + items.length + ')';
      })
      .catch(function (err) {
        container.innerHTML = '<p class="text-sm text-red-500 py-4">Failed to load: ' + u.escapeHtml(err.message) + '</p>';
      });
  }

  // ── Subscriptions ─────────────────────────────────────────────

  function subscribeToContact(contactId) {
    try {
      contactQuery = plugin
        .switchTo(MODELS.Contact.sdkName)
        .query()
        .select(MODELS.Contact.detailFields)
        .where('id', '=', contactId)
        .noDestroy();

      contactSub = contactQuery.subscribe().subscribe(function (payload) {
        if (!payload) return;
        var updatedData = null;
        if (Array.isArray(payload) && payload.length > 0) {
          var item = payload[0];
          updatedData = item && item.getState ? item.getState() : item;
        } else if (payload && payload.records) {
          var record = Object.values(payload.records)[0];
          updatedData = record && record.getState ? record.getState() : record;
        } else if (payload && typeof payload === 'object') {
          updatedData = payload.getState ? payload.getState() : payload;
        }
        // VitalSync subscription payloads may not include 'id' —
        // we already know the contact ID from the query filter
        if (updatedData && typeof updatedData === 'object' && Object.keys(updatedData).length > 0) {
          console.log('Contact updated via subscription');
          // Only merge fields that have defined, non-null values
          var merged = Object.assign({}, currentContact);
          Object.keys(updatedData).forEach(function (key) {
            if (updatedData[key] !== undefined && updatedData[key] !== null) {
              merged[key] = updatedData[key];
            }
          });
          // Preserve id from the original contact
          merged.id = contactId;
          currentContact = merged;
          renderContactDetail(currentContact);
          u.showToast('Contact updated', 'info', 2000);
        }
      });

      // Show live indicator
      u.byId('liveIndicator').classList.remove('hidden');
    } catch (err) {
      console.log('Subscription failed:', err.message);
    }
  }

  function cleanupSubscriptions() {
    if (contactSub) { contactSub.unsubscribe(); contactSub = null; }
    if (contactQuery) { try { contactQuery.destroy(); } catch (e) {} contactQuery = null; }
    var indicator = u.byId('liveIndicator');
    if (indicator) indicator.classList.add('hidden');
  }

  window.addEventListener('beforeunload', cleanupSubscriptions);

  // ── Status Badge Helpers ──────────────────────────────────────

  function statusBadge(status, colorHint) {
    if (!status) return '<span class="text-xs text-gray-400">—</span>';
    var colors = badgeColors(status, colorHint);
    return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ' + colors + '">' + u.escapeHtml(status) + '</span>';
  }

  function badgeColors(status, hint) {
    if (hint === 'green') return 'bg-green-100 text-green-800';
    if (hint === 'red') return 'bg-red-100 text-red-800';
    if (hint === 'blue') return 'bg-blue-100 text-blue-800';
    var s = (status || '').toLowerCase();
    if (s.includes('paid') || s.includes('completed') || s.includes('fulfilled') || s.includes('approved') || s.includes('live') || s.includes('eligible') || s.includes('active') || s.includes('won'))
      return 'bg-green-100 text-green-800';
    if (s.includes('cancel') || s.includes('suspend') || s.includes('declined') || s.includes('refund') || s.includes('void') || s.includes('lost') || s.includes('ineligible') || s.includes('terminated') || s.includes('issue'))
      return 'bg-red-100 text-red-800';
    if (s.includes('booked') || s.includes('processing') || s.includes('progress') || s.includes('transit') || s.includes('open') || s.includes('draft'))
      return 'bg-yellow-100 text-yellow-800';
    if (s.includes('new') || s.includes('quiz') || s.includes('intake') || s.includes('pending'))
      return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  }

  // Application status with specific color mapping
  var APP_STATUS_COLORS = {
    'New': 'bg-blue-100 text-blue-800',
    'Quiz Success': 'bg-blue-100 text-blue-800',
    'Intake Form Completed': 'bg-yellow-100 text-yellow-800',
    'Initial Consultation Booked': 'bg-yellow-100 text-yellow-800',
    'Initial Consultation Paid': 'bg-green-100 text-green-800',
    'External Processing $99': 'bg-yellow-100 text-yellow-800',
    'Item Purchased': 'bg-green-100 text-green-800',
    'Script Uploaded': 'bg-green-100 text-green-800',
    'Cancelled': 'bg-red-100 text-red-800',
    'Suspended': 'bg-red-100 text-red-800',
  };

  function appStatusBadge(status) {
    if (!status) return '<span class="text-xs text-gray-400">—</span>';
    var colors = APP_STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
    return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ' + colors + '">' + u.escapeHtml(status) + '</span>';
  }

  function boolBadge(val, label, color) {
    var c = color === 'red' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
    if (!val) c = 'bg-gray-100 text-gray-800';
    return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ' + c + '">' + (label || (val ? 'Yes' : 'No')) + '</span>';
  }

  function longTextRow(label, text) {
    return '<div class="py-1.5 border-b border-gray-100 last:border-0">' +
      '<span class="text-sm text-gray-500 block mb-0.5">' + label + '</span>' +
      '<p class="text-sm text-gray-900 whitespace-pre-line">' + u.escapeHtml(text) + '</p>' +
      '</div>';
  }

  /** Render a row with trusted HTML content (e.g. server-generated AI notes) */
  function htmlContentRow(label, html) {
    return '<div class="py-1.5 border-b border-gray-100 last:border-0">' +
      '<span class="text-sm text-gray-500 block mb-0.5">' + label + '</span>' +
      '<div class="text-sm text-gray-900 prose prose-sm max-w-none">' + html + '</div>' +
      '</div>';
  }

  function scriptStatusBadge(status) { return statusBadge(status); }
  function purchaseStatusBadge(status) { return statusBadge(status); }
  function dispenseStatusBadge(status) { return statusBadge(status); }

})();
