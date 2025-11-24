class PLDic {
    constructor() {
        this.data = {};
    }

    // Reset the object
    RESET() {
        this.data = {};
    }

    // Get key value as string
    GETS(key) {
        return this.data[key] ? this.data[key].toString() : '';
    }

    // Get key value with trim
    GETST(key) {
        return this.data[key] ? this.data[key].toString().trim() : '';
    }

    // Get key value in uppercase
    GETU(key) {
        return this.data[key] ? this.data[key].toString().toUpperCase() : '';
    }

    // Check if key IS EMPTY
    EMPTY(key) {
        return !this.data[key] || this.data[key].toString().trim() === '';
    }

    // Get key value as logical (Y means true)
    GETL(key) {
        return this.data.hasOwnProperty(key) && this.data[key] == "Y";
    }

    // Get key value as integer
    GETI(key) {
        const value = this.data[key] ? this.data[key].toString().trim() : '';
        return value ? parseInt(value) : 0;
    }

    // Get key value as double
    GETD(key) {
        const value = this.data[key] ? this.data[key].toString().trim() : '';
        return value ? parseFloat(value) : 0;
    }

    // Check if key value IS equal to a string
    IS(key, value) {
        return this.data[key] ? this.data[key].toString() === value : false;
    }

    // Check if key value CONTAINS a string
    CONTAIN(key, value) {
        return this.data[key] ? this.data[key].toString().includes(value) : false;
    }

    // Compare key value with a string
    COMPAIR(key, value) {
        return this.data[key] ? this.data[key].toString() === value : false;
    }

    // Compare key value with an integer
    COMPAIRINT(key, value) {
        return this.GETI(key) === value;
    }

    // Compare key value with a double
    COMPAIRDOUBLE(key, value) {
        return this.GETD(key) === value;
    }

    // Check if key value IS in the list of items
    INLIST(key, items) {
        const itemList = items.includes(',') ? items.split(',').map(itm => itm.trim()) : [items];
        if (this.data?.hasOwnProperty(key)) {
            const value = this.data[key];
            return itemList.includes(value != null ? value.toString() : '');
        } else {
            return itemList.includes(key);
        }
    }

    // Check if key value IS contained in a list item
    CONTAINS(key, listItem) {
        return listItem.includes(this.GETS(key));
    }

    // Add or update a key in the object
    ADDKEY(key, value) {
        this.data[key] = value;
    }

    // Return the object representing the data (for external access)
    GETDATA() {
        return this.data;
    }

    // Check if an expression is included in a comma-separated list
    INCLUDE(toExpression, toItemsString) {
        const toItems = toItemsString.split(',').map(item => item.trim());
        return toItems.includes(toExpression.toString());
    }

    // Get right n characters of string
    RIGHT(cSTID, nNoChar) {
        return cSTID.substring(cSTID.length - nNoChar);
    }
}

// Exporting an instance like before
module.exports = PLDic;
