import orderModel from "../models/orderModel.js"
import userModel from "../models/userModel.js"
import Stripe from "stripe"

//Global Variables for payment
const currency = 'pkr'
const deliveryCharges = 10

//Stripe gateway integration
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

//Place Order Using Cash On Delivery
const placeOrder = async (req,res)=>{
   try {
    const {userId, items, amount, address} = req.body
    
    const orderData = {
        userId,
        items,
        amount,
        address,
        paymentMethod:"COD",
        payment:false,
        date:Date.now()
    }
    const newOrder = new orderModel(orderData)
    await newOrder.save()

    await userModel.findByIdAndUpdate(userId,{cartData: {}})

    res.json({success:true, message:"Order Placed"})
   } catch (error) {
    console.log(error)
    res.json({success:true, message:error.message})
    }
}

//Place order Using Stripe
const placeOrderStripe = async (req,res)=>{
  try {
    const { userId, items, amount, address } = req.body
    const {origin} = req.headers

    const orderData = {
      userId,
      items,
      amount,
      address,
      paymentMethod:"Stripe",
      payment:false,
      date:Date.now()
  }
  const newOrder = new orderModel(orderData)
  await newOrder.save()

  const line_items = items.map((item)=>({
    price_data:{
      currency:currency,
      product_data:{
        name:item.name
      },
      //unit_amount:item.price * 100 * 277
      unit_amount: Math.round(item.price * 100)
    },
    quantity: item.quantity
  }))
  line_items.push({
    price_data:{
      currency:currency,
      product_data:{
        name: 'Delivery charges'
      },
      //unit_amount: deliveryCharges * 100 * 277
       unit_amount: Math.round(deliveryCharges * 100)
    },
    quantity: 1
  })
  const session = await stripe.checkout.sessions.create({
    success_url: `${origin}/verify?success=true&orderId=${newOrder._id}`,
    cancel_url: `${origin}/verify?success=false&orderId=${newOrder._id}`,
    line_items,
    mode: 'payment'
  })
  res.json({success:true, session_url:session.url})

  } catch (error) {
    console.log(error)
    res.json({success:false, message: error.message})
  }
}
//Verify Stripe Method
const verifyStripe = async (req,res)=>{
  const {orderId, success, userId} = req.body
  try {
    if(success ==="true"){
      await orderModel.findByIdAndUpdate(orderId, { payment: true})
      await userModel.findByIdAndUpdate(userId, { cartData: {}})
      res.json({ success: true })
    }else{
      await orderModel.findByIdAndDelete(orderId)
      res.json({ success: false })
    }
  } catch (error) {
    console.log(error)
    res.json({success:false, message:error.message})
  }
}

//All Orders data for admin pannel
const allOrders = async (req, res) => {
  try {
    const orders = await orderModel.find().populate('userId', 'name email');// Fetch all orders with user details
    res.json({ success: true, orders });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

//All Orders data for FrontEnd
const userOrders = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.json({ success: false, message: "User ID is required" });
    }

    const orders = await orderModel.find({ userId }).populate("items"); // Populate items if needed
    res.json({ success: true, orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


//All Orders status for admin pannel
const updateStatus = async (req,res)=>{
 try {
  const {orderId, status} = req.body
  await orderModel.findByIdAndUpdate(orderId, {status})
  res.json({success:true, message: 'Status Updated'})
 } catch (error) {
  console.log(error)
    res.json({success:false, message:error.message})
 }
}

export {placeOrder, placeOrderStripe, allOrders, userOrders, updateStatus, verifyStripe}