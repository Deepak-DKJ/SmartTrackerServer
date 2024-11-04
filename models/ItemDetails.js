const mongoose = require('mongoose');

const itemDetailsSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemName: { type: String, required: true, default: 'Miscellaneous' },
    quantity: { type: String, required: true, default: '1 unit' },
    totalPrice: { type: Number, required: true, default: 0 }, 
    type: { type: String, required: true, default: 'Expenses' },
    category: { type: String, required: true, default: 'Others' },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ItemDetails', itemDetailsSchema);
