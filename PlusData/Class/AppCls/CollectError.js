class CollectError {
    constructor(separator = "\n") {
        this.errors = {};           // Similar to Dictionary<string, string>
        this.cEMsg = "";            // Combined error message
        this.cSep = separator;      // Separator between messages
        this.lError = false;        // Boolean flag indicating if any error occurred
    }

    // Add error with a specific key
    addErr(key, message) {
        if (typeof message === 'undefined') {
            // If only one argument, treat it as message and generate key
            message = key;
            key = `AERR-${Object.keys(this.errors).length}`;
        }

        // Append to combined message
        this.cEMsg += (this.cEMsg.trim() ? this.cSep : '') + message;

        // Set error flag and store in dictionary
        this.lError = true;
        this.errors[key] = message;
    }

    // Add error from exception object
    addException(ex) {
        const key = `AERR-${Object.keys(this.errors).length}`;
        const message = ex.message + (ex.inner ? `: ${ex.inner}` : '');
        this.cEMsg += (this.cEMsg.trim() ? this.cSep : '') + message;
        this.lError = true;
        this.errors[key] = message;
    }

    // Reset all error data
    reset() {
        this.errors = {};
        this.cEMsg = "";
        this.lError = false;
    }

    // Copy errors from another CollectError instance
    copyFrom(other) {
        if (!other || typeof other !== 'object') return;

        for (const [key, value] of Object.entries(other.errors)) {
            if (this.errors.hasOwnProperty(key)) {
                this.addErr(value);
            } else {
                this.addErr(key, value);
            }
        }
    }
}
module.exports = CollectError