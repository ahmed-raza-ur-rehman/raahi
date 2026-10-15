package pk.raahi.feature.opportunities

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import java.time.Instant
import pk.raahi.core.designsystem.BadgeModel
import pk.raahi.core.designsystem.OpportunityCardModel
import pk.raahi.core.designsystem.Tone
import pk.raahi.core.model.DeadlineStatus
import pk.raahi.core.model.Funding
import pk.raahi.core.model.Level
import pk.raahi.core.model.Opportunity
import pk.raahi.core.model.OpportunityKind
import pk.raahi.core.model.StatusInfo
import pk.raahi.core.model.isNew
import pk.raahi.core.model.statusAt

@StringRes
internal fun OpportunityKind.labelRes(): Int = when (this) {
    OpportunityKind.SCHOLARSHIP -> R.string.kind_scholarship
    OpportunityKind.FELLOWSHIP -> R.string.kind_fellowship
    OpportunityKind.INTERNSHIP -> R.string.kind_internship
    OpportunityKind.JOB -> R.string.kind_job
    OpportunityKind.COMPETITION -> R.string.kind_competition
    OpportunityKind.COURSE -> R.string.kind_course
    OpportunityKind.COUPON -> R.string.kind_coupon
    OpportunityKind.TRAINING -> R.string.kind_training
    OpportunityKind.GRANT -> R.string.kind_grant
    OpportunityKind.ADMISSION -> R.string.kind_admission
    OpportunityKind.NOTICE -> R.string.kind_notice
    OpportunityKind.UNKNOWN -> R.string.kind_unknown
}

@StringRes
internal fun Level.labelRes(): Int = when (this) {
    Level.SCHOOL -> R.string.level_school
    Level.UNDERGRADUATE -> R.string.level_undergraduate
    Level.MASTERS -> R.string.level_masters
    Level.PHD -> R.string.level_phd
    Level.POSTDOC -> R.string.level_postdoc
    Level.PROFESSIONAL -> R.string.level_professional
    Level.ANY -> R.string.level_any
}

@StringRes
internal fun Funding.labelRes(): Int? = when (this) {
    Funding.FULL -> R.string.funding_full
    Funding.PARTIAL -> R.string.funding_partial
    Funding.STIPEND -> R.string.funding_stipend
    Funding.PAID -> R.string.funding_paid
    Funding.FREE -> R.string.funding_free
    Funding.UNKNOWN -> null
}

/** The deadline badge. Days are counted on the Pakistan calendar (core.model.statusOf). */
@Composable
internal fun statusBadge(info: StatusInfo): BadgeModel = when (info.status) {
    DeadlineStatus.OPEN -> BadgeModel(stringResource(R.string.status_open), Tone.Positive)
    DeadlineStatus.CLOSING_SOON -> {
        val days = info.daysLeft ?: 0
        BadgeModel(if (days == 0) stringResource(R.string.status_closing_today) else pluralStringResource(R.plurals.status_closing_days, days, days), Tone.Warning)
    }
    DeadlineStatus.CLOSED -> BadgeModel(stringResource(R.string.status_closed), Tone.Neutral)
    DeadlineStatus.ROLLING -> BadgeModel(stringResource(R.string.status_rolling), Tone.Info)
    DeadlineStatus.UNKNOWN -> BadgeModel(stringResource(R.string.status_unknown), Tone.Neutral)
}

@Composable
internal fun Opportunity.toCardModel(now: Instant, saved: Boolean): OpportunityCardModel {
    val status = statusBadge(statusAt(now))
    val newBadge = if (isNew(firstSeen, now)) BadgeModel(stringResource(R.string.badge_new), Tone.Highlight) else null
    val fundingBadge = funding?.labelRes()?.let { BadgeModel(stringResource(it), Tone.Positive) }
    val pakistanBadge = when (openToPakistan) {
        true -> BadgeModel(stringResource(R.string.badge_open_pk), Tone.Info)
        false -> BadgeModel(stringResource(R.string.badge_excludes_pk), Tone.Danger)
        null -> null
    }
    val kindLabel = stringResource(kind.labelRes())
    return OpportunityCardModel(id, title, kindLabel, organization, country ?: location, listOfNotNull(status, newBadge, fundingBadge, pakistanBadge), saved)
}
