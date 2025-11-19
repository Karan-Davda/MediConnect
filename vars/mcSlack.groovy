// vars/mcSlack.groovy
def call(
    String status,          // "success" or "failure"
    String envName,         // DEV / QA / NONE
    String commitShort,
    String commitSubject,
    String buildUrl,
    String jobName,
    String branchName
) {
    def color = (status == 'success') ? '#2EB67D' : '#E01E5A'
    def emoji = (status == 'success') ? ':white_check_mark:' : ':x:'

    slackSend(
        color: color,
        message:
            "*${commitSubject}*\n" +
            "${emoji} *Build ${status.toUpperCase()}* — `${jobName}`\n" +
            (envName ? "Env: *${envName}*\n" : "") +
            "Branch: *${branchName}*\n" +
            "Commit: `${commitShort}`\n" +
            "<${buildUrl}|View Console Output>"
    )
}
