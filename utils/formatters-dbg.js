/*
 * Copyright (C) 2009-2017 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"hcm/fab/myleaverequest/utils/utils",
	"sap/ui/model/odata/type/Decimal",
	"sap/ui/core/format/DateFormat",
	"sap/ui/core/format/NumberFormat",
	"sap/ui/core/LocaleData"
], function(utils, Decimal, DateFormat, NumberFormat, LocaleData) {
	"use strict";

	function formatFeedTimeStamp(sDate, sTime) {
		var oDateFormat = DateFormat.getDateInstance(),
			oTimeFormat = DateFormat.getTimeInstance(),
			oDateTimeFormat = DateFormat.getDateTimeInstance(),
			oDate = oDateFormat.parse(sDate),
			oTime = oTimeFormat.parse(sTime),
			newDate = new Date(oDate.getFullYear(), oDate.getMonth(), oDate.getMonth(), oTime.getHours(), oTime.getMinutes(), oTime.getSeconds());

		return oDateTimeFormat.format(newDate);
	}

	// Shows the date as a single date instead of a dash-separated interval.
	function formatOverviewLeaveDates(sStartDate, sEndDate) {
		if (sStartDate === sEndDate) {
			return sStartDate;
		}
		var sFormatLocale = sap.ui.getCore().getConfiguration().getFormatSettings().getFormatLocale(),
			sDateRange = LocaleData.getInstance(sFormatLocale).getIntervalPattern("d - d");
		sDateRange = sDateRange.replace("{0}", sStartDate);
		sDateRange = sDateRange.replace("{1}", sEndDate);
		return sDateRange;
	}

	//Convert Start/End time to locale conform (short) value 
	function formatTimeToShortLocale(sStartTime, sEndTime) {
		var sFormatLocale = sap.ui.getCore().getConfiguration().getFormatSettings().getFormatLocale(),
			sDateRange = LocaleData.getInstance(sFormatLocale).getIntervalPattern("t - t");

		var oTimeFormatterShort = DateFormat.getTimeInstance({
				style: "short"
			}),
			oStartTime = oTimeFormatterShort.parse(sStartTime),
			oEndTime = oTimeFormatterShort.parse(sEndTime);

		sStartTime = oTimeFormatterShort.format(oStartTime);
		sEndTime = oTimeFormatterShort.format(oEndTime);

		sDateRange = sDateRange.replace("{0}", sStartTime);
		sDateRange = sDateRange.replace("{1}", sEndTime);

		return sDateRange;
	}

	function displayTimeShort() {
		var oTimeFormatterShort = DateFormat.getTimeInstance({
			style: "short"
		});
		return oTimeFormatterShort.oFormatOptions.pattern;
	}

	function formatUsedQuota(sQuota) {
		if (sQuota === "0") {
			return null;
		} else {
			return sQuota;
		}
	}

	function formatTimeAccountTypeText(sText, oDate) {
		return jQuery.sap.formatMessage(sText, [oDate, oDate]);
	}

	function formatTimeAccountValidity(sStartDate, sEndDate) {
		var sFormatLocale = sap.ui.getCore().getConfiguration().getFormatSettings().getFormatLocale(),
			sDateRange = LocaleData.getInstance(sFormatLocale).getIntervalPattern("d - d");
		sDateRange = sDateRange.replace("{0}", sStartDate);
		sDateRange = sDateRange.replace("{1}", sEndDate);
		return sDateRange;
	}

	function localMessageFormatter(a, b, c) {
		if (!b & !c) {
			return "";
		} else {
			return jQuery.sap.formatMessage.apply(this, arguments);
		}
	}

	function itemCountFormatter(iCount) {
		return this.getResourceBundle().getText("items", [iCount]);
	}

	function formatUsedQuotaAttribute(sText, sQuota, sTimeUnit) {
		var displayedQuota = formatUsedQuota(sQuota);
		return localMessageFormatter(sText, displayedQuota, sTimeUnit);
	}

	function formatEntitlementStatus(sDaysLeft) {
		var fValue = parseFloat(sDaysLeft);
		if (fValue > 0) {
			return sap.ui.core.ValueState.Success;
		} else if (fValue < 0) {
			return sap.ui.core.ValueState.Error;
		} else {
			return sap.ui.core.ValueState.None;
		}
	}

	function statusCodeFormatter(sStatus) {
		// Type01: light orange
		// Type02: dark orange
		// Type03: red
		// Type04: brown
		// Type05: pink
		// Type06: blue
		// Type07: light green
		// Type08: dark green
		// Type09: cyan
		// Type10: purple
		switch (sStatus) {
			case "POSTED":
			case "APPROVED":
				return "Type08";
			case "SENT":
				return "Type01";
			case "REJECTED":
				return "Type03";
			default: //fallback (should not happen)
				return "Type06";
		}
	}

	// Formatting method to set the right status of the list items          
	function statusFormatter(sStatus) {
		switch (sStatus) {
			case "POSTED":
			case "APPROVED":
				return sap.ui.core.ValueState.Success;
			case "SENT":
				return sap.ui.core.ValueState.Warning;
			case "REJECTED":
				return sap.ui.core.ValueState.Error;
			default: //fallback (should not happen)
				return sap.ui.core.ValueState.None;
		}
	}

	// 
	// AllowedDurationMultipleDayInd controls whether a one or range
	// of days can be selected. Therefore:
	//
	// - AllowedDurationMultipleDayInd -> can select multiple day (or single day)
	// - !AllowedDurationMultipleDayInd -> can select only a single day
	//
	function isMoreThanOneDayAllowed(bAllowedDurationMultipleDay) {
		return !!bAllowedDurationMultipleDay;
	}

	function isOneDayOrLessAllowed(bAllowedDurationMultipleDay, bAllowedDurationSingleDay) {
		return !!bAllowedDurationMultipleDay || !!bAllowedDurationSingleDay;
	}

	function isTimeRangeAllowed(bMultiOrSingleDayRadioGroupIndex, bAllowedDurationPartialDayInd) {
		return bMultiOrSingleDayRadioGroupIndex === 1 && !!bAllowedDurationPartialDayInd;
	}

	function isTimeRangeNotAllowed(bMultiOrSingleDayRadioGroupIndex, bAllowedDurationPartialDayInd) {
		return bMultiOrSingleDayRadioGroupIndex === 1 && !bAllowedDurationPartialDayInd;
	}

	function isCalculationSpanAvailableAfterDateRange(bMultiOrSingleDayRadioGroupIndex, bShowCalculation) {
		if (bShowCalculation) {
			if (bMultiOrSingleDayRadioGroupIndex === 0) {
				return true;
			} else {
				return false;
			}
		} else {
			return false;
		}
	}

	function isCalculationSpanAvailableAfterDatePicker(bMultiOrSingleDayRadioGroupIndex, bAllowedDurationPartialDayInd, bShowTimePicker,
		bShowInputHours, bShowCalculation) {
		if (bShowCalculation) {
			if (bMultiOrSingleDayRadioGroupIndex === 1 && !!bAllowedDurationPartialDayInd) {
				if (bShowTimePicker || bShowInputHours) {
					return false;
				} else {
					return true;
				}
			} else {
				return false;
			}
		} else {
			return false;
		}
	}

	function isCalculationSpanAvailableAfterTimeRange(bMultiOrSingleDayRadioGroupIndex, bAllowedDurationPartialDayInd, bShowTimePicker,
		bShowInputHours, bShowCalculation) {
		if (bShowCalculation) {
			if (bMultiOrSingleDayRadioGroupIndex === 1 && !!bAllowedDurationPartialDayInd) {
				if (bShowTimePicker && !bShowInputHours) {
					return true;
				} else {
					return false;
				}
			} else {
				return false;
			}
		} else {
			return false;
		}
	}

	function isCalculationSpanAvailableAfterHourInput(bMultiOrSingleDayRadioGroupIndex, bAllowedDurationPartialDayInd, bShowTimePicker,
		bShowInputHours, bShowCalculation) {
		if (bShowCalculation) {
			if (bMultiOrSingleDayRadioGroupIndex === 1) {
				if (bShowInputHours) {
					return true;
				} else {
					return false;
				}
			} else {
				return false;
			}
		} else {
			return false;
		}
	}

	function isTimePickerAvailable(bMultiOrSingleDayRadioGroupIndex, bShowTimePicker) {
		if (bMultiOrSingleDayRadioGroupIndex === 1 && !!bShowTimePicker) {
			return true;
		} else {
			return false;
		}
	}

	function isInputHoursAvailable(bMultiOrSingleDayRadioGroupIndex, bShowInputHours) {
		if (bMultiOrSingleDayRadioGroupIndex === 1 && !!bShowInputHours) {
			return true;
		} else {
			return false;
		}
	}

	function getSingleOrMultipleApproverLabel(bIsMultiple, sSingleLabel, sMultipleLabel) {
		return bIsMultiple ? sMultipleLabel : sSingleLabel;
	}

	function isApproverPlusMinusButtonVisible(bAddDelApprovers, bMultipleApproverFlag) {
		return !!(bMultipleApproverFlag && bAddDelApprovers);
	}

	function isLastControl(iTotalControls, sAggregationName) {
		// 'this' is expected to be the control the formatter was
		// called on
		var iSuperControlIdx = getSuperControlIndex(this, sAggregationName);

		return iSuperControlIdx === (iTotalControls - 1);
	}

	function isFirstControl(sAggregationName) {
		// 'this' is expected to be the control the formatter was
		// called on
		return getSuperControlIndex(this, sAggregationName) === 0;
	}

	/**
	 * Returns whether the additional field should be rendered as a checkbox or
	 * not.
	 *
	 * @param {string} sType
	 *   A one character string. e.g., "P"
	 *
	 * @param {string} sLength
	 *   The field length (can be zero-padded). E.g., "000002".
	 *
	 * @return {boolean}
	 *   Whether the additional field of the given type should be rendered as a
	 *   checkbox.
	 */
	function isAdditionalFieldCheckbox(sType, sLength) {
		return !!(sType === "C" && parseInt(sLength, 10) === 1);
	}

	/**
	 * Returns whether the given array has items.
	 *
	 * @param {array} aItems
	 *   An array
	 *
	 * @returns {boolean}
	 *   Returns true if the array has items, and false if the array has zero
	 *   length or it's not an array.
	 */
	function hasItems(aItems) {
		if (!jQuery.isArray(aItems)) {
			return false;
		}
		return aItems.length > 0;
	}

	/**
	 * Returns the index of a super control for a control rendered in a
	 * certain aggegation.  This control must be structured in the view
	 * like:
	 *
	 * <pre>
	 *  <VerticalLayout>
	 *     <aggregation>
	 *        <SuperControl>
	 *           <Control />
	 *           <SiblingControl1 />
	 *           <SiblingControl2 />
	 *           <SiblingControl3 />
	 *           ...
	 *        </SuperControl>
	 *     </aggregation>
	 *  </VerticalLayout>
	 * </pre>
	 *
	 * Of course this method would work also when a SiblingControl is
	 * passed, as the index of the SuperControl (relative to the
	 * aggregation) is returned.
	 *
	 * @param {object} oControl
	 *    The child of the SuperControl
	 *
	 * @param {string} sAggregationName 
	 *    The name of the aggregation containing SuperControls
	 *
	 * @returns {number}
	 *    The index of the SuperControl within the aggregation or null if the
	 *    SuperControl could not be found in the aggregation.
	 */
	function getSuperControlIndex(oControl) {
		// the group of button + input field
		var oSuperControl = oControl.getParent(); // the SuperControl
		var oAggregation = oSuperControl.getParent().getAggregation("content");

		var oSuperControlFound = oAggregation
			.map(function(oSuperControl, iIdx) {
				return {
					superControl: oSuperControl,
					idx: iIdx
				};
			})
			.filter(function(oAggregationSuperControlInfo) {
				return oAggregationSuperControlInfo.superControl === oSuperControl;
			})[0];

		if (!oSuperControlFound) {
			return null;
		}

		return oSuperControlFound.idx;
	}

	function isGroupEnabled(oStartDate, sSelectedAbsenceTypeCode) {
		return !!(oStartDate && sSelectedAbsenceTypeCode);
	}

	function isInputHoursEnabled(oStartDate, sSelectedAbsenceTypeCode, bTimeRangeFilled) {
		return isGroupEnabled(oStartDate, sSelectedAbsenceTypeCode) && !bTimeRangeFilled;
	}

	function isTimePickerEnabled(oStartDate, sSelectedAbsenceTypeCode, bInputHoursFilled) {
		return isGroupEnabled(oStartDate, sSelectedAbsenceTypeCode) && !bInputHoursFilled;
	}

	function availableDays(sAvailableDays) {
		if (!isNaN(parseFloat(sAvailableDays))) {
			var oNumberFormat = NumberFormat.getFloatInstance({
				minFractionDigits: 0,
				maxFractionDigits: 2
			});
			return oNumberFormat.format(sAvailableDays);
		}
		return sAvailableDays;
	}

	function usedTimeVisibility(sUsedDays) {
		if (sUsedDays > 0) {
			return true;
		} else {
			return false;
		}
	}

	function isGroupDisabled( /* same signature as isGroupEnabled */ ) {
		return !isGroupEnabled.apply(this, arguments);
	}

	function parseColonSeparatedString(sColonSeparated) {
		//::NEW::00000011::::Herr Michael Kennedy::::Dude where is my car::::20161216::::041550::::HAW
		var oFieldMapping = [
			"EmployeeId",
			"EmployeeName",
			"Text",
			"Date",
			"Time",
			"Timezone"
		];
		var aResult = [];
		if (sColonSeparated) {
			aResult = sColonSeparated.split("::NEW::")
				.filter(function(sFields) {
					return sFields.length > 0;
				})
				.map(function(sFields) {
					var oFields = {};

					sFields.split("::::").forEach(function(sFieldValue, iFieldIdx) {
						var sFieldName = oFieldMapping[iFieldIdx];
						oFields[sFieldName] = sFieldValue;
					});

					return oFields;
				});
		}
		return aResult;
	}

	function formatNotes(sNote) {
		return parseColonSeparatedString(sNote);
	}

	function enableAddApprover(oStartDate, sSelectedAbsenceTypeCode, iApproverLevel, aMultipleApprovers) {
		var bGroupEnabled = isGroupEnabled(oStartDate, sSelectedAbsenceTypeCode);
		return bGroupEnabled && aMultipleApprovers.length < iApproverLevel;
	}

	function hasNoItems(aItems) {
		return !hasItems(aItems);
	}

	function isOldNotesVisible(sOldNotes) {
		return !!(sOldNotes && sOldNotes.indexOf("::") >= 0);
	}

	function isAdditionalApproverRemoveIconEnabled(aMultipleApprovers) {
		/* eslint-disable consistent-this */
		var oControl = this;
		/* eslint-enable consistent-this */

		return isLastControl.call(oControl, aMultipleApprovers.length, 'content') && !isFirstControl.call(oControl, 'content');
	}

	function isAdditionalFieldInput(sType, sLength) {
		return !!(sType === "C" && parseInt(sLength, 10) > 1);
	}

	function isAdditionalFieldInputDecimal(sType) {
		return !!(sType === "P");
	}

	function isAdditionalFieldInputInteger(sType) {
		return !!(sType === "N");
	}

	function isAdditionalFieldLabelVisible(sFieldType, sFieldLength) {
		return !isAdditionalFieldCheckbox(sFieldType, sFieldLength);
	}

	function formatAvailablityUsageStrip(sNumber, sNumberUnit, sText) {
		if ((sNumber || !isNaN(parseFloat(sNumber))) && sNumberUnit && sText) {
			return availableDays(sNumber) + " " + sNumberUnit + " " + sText;
		} else if (sNumber || !isNaN(parseFloat(sNumber))) {
			return sNumber;
		}
		return "";
	}

	function calendarOverlapText(iOverlapNumber, sNoOverlapText, sHasOverlapText) {
		if (iOverlapNumber > 0) {
			if (sHasOverlapText) {
				return sHasOverlapText.replace("{0}", iOverlapNumber);
			} else {
				return sHasOverlapText;
			}
		} else {
			return sNoOverlapText;
		}
	}

	function formatQuotaAvailability(availabilityAmount, bIsQuotaRelevant) {
		if (!availabilityAmount) {
			return "";
		}
		if (!bIsQuotaRelevant) {
			return this.getResourceBundle().getText("noQuotaRelevance");
		}
		return availableDays(availabilityAmount);

	}

	return {
		localMessageFormatter: localMessageFormatter,
		statusFormatter: statusFormatter,
		statusCodeFormatter: statusCodeFormatter,
		itemCountFormatter: itemCountFormatter,
		getSingleOrMultipleApproverLabel: getSingleOrMultipleApproverLabel,
		isApproverPlusMinusButtonVisible: isApproverPlusMinusButtonVisible,
		getSuperControlIndex: getSuperControlIndex,
		availableDays: availableDays,
		usedTimeVisibility: usedTimeVisibility,
		isGroupEnabled: isGroupEnabled,
		isGroupDisabled: isGroupDisabled,
		formatNotes: formatNotes,
		enableAddApprover: enableAddApprover,
		hasItems: hasItems,
		hasNoItems: hasNoItems,
		isOldNotesVisible: isOldNotesVisible,
		isAdditionalApproverRemoveIconEnabled: isAdditionalApproverRemoveIconEnabled,
		isAdditionalFieldCheckbox: isAdditionalFieldCheckbox,
		isAdditionalFieldInput: isAdditionalFieldInput,
		isAdditionalFieldInputDecimal: isAdditionalFieldInputDecimal,
		isAdditionalFieldInputInteger: isAdditionalFieldInputInteger,
		isAdditionalFieldLabelVisible: isAdditionalFieldLabelVisible,
		isMoreThanOneDayAllowed: isMoreThanOneDayAllowed,
		isOneDayOrLessAllowed: isOneDayOrLessAllowed,
		isTimeRangeAllowed: isTimeRangeAllowed,
		isTimeRangeNotAllowed: isTimeRangeNotAllowed,
		isCalculationSpanAvailableAfterDateRange: isCalculationSpanAvailableAfterDateRange,
		isCalculationSpanAvailableAfterDatePicker: isCalculationSpanAvailableAfterDatePicker,
		isCalculationSpanAvailableAfterTimeRange: isCalculationSpanAvailableAfterTimeRange,
		isCalculationSpanAvailableAfterHourInput: isCalculationSpanAvailableAfterHourInput,
		isTimePickerAvailable: isTimePickerAvailable,
		isTimePickerEnabled: isTimePickerEnabled,
		isInputHoursAvailable: isInputHoursAvailable,
		isInputHoursEnabled: isInputHoursEnabled,
		formatFeedTimeStamp: formatFeedTimeStamp,
		formatOverviewLeaveDates: formatOverviewLeaveDates,
		formatUsedQuota: formatUsedQuota,
		formatUsedQuotaAttribute: formatUsedQuotaAttribute,
		formatTimeAccountTypeText: formatTimeAccountTypeText,
		formatTimeAccountValidity: formatTimeAccountValidity,
		formatEntitlementStatus: formatEntitlementStatus,
		displayTimeShort: displayTimeShort,
		formatTimeToShortLocale: formatTimeToShortLocale,
		calendarOverlapText: calendarOverlapText,
		formatAvailablityUsageStrip: formatAvailablityUsageStrip,
		formatQuotaAvailability: formatQuotaAvailability
	};

}, true /* bExport */ );