// Thay thế URL này bằng URL Web App bạn đã deploy ở Bước 2
const API_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL'; 

const bookingForm = document.getElementById('bookingForm');
const formMessage = document.getElementById('formMessage');
const queueList = document.getElementById('queueList');
const currentTimeSpan = document.getElementById('currentTime');
const myTurnMessage = document.getElementById('myTurnMessage');

// --- HÀM GỬI DỮ LIỆU BOOKING ---
bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formMessage.textContent = 'Đang gửi yêu cầu...';

    const nickname = document.getElementById('nickname').value;
    const startTime = document.getElementById('startTime').value;
    const duration = document.getElementById('duration').value;
    
    // Lưu nickname vào bộ nhớ local để kiểm tra "lượt của tôi"
    localStorage.setItem('myNickname', nickname);

    const bookingData = {
        timestamp: new Date().toISOString(),
        nickname: nickname,
        startTime: new Date(startTime).toISOString(),
        duration: parseInt(duration),
        status: 'approved' // Mặc định là 'approved', bạn có thể đổi thành 'pending' nếu muốn duyệt tay
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors', // Cần thiết để gọi API từ domain khác
            headers: {
                'Content-Type': 'application/json',
            },
            // Google Apps Script yêu cầu postData.contents nên ta cần stringify object
             body: JSON.stringify(bookingData)
        });

        const result = await response.json();

        if (result.status === 'success') {
            formMessage.textContent = 'Đặt chỗ thành công! Đang làm mới danh sách...';
            formMessage.style.color = 'green';
            bookingForm.reset();
            fetchQueue(); // Tải lại danh sách hàng chờ
        } else {
            throw new Error('Có lỗi xảy ra từ API');
        }
    } catch (error) {
        console.error('Error:', error);
        formMessage.textContent = 'Đặt chỗ thất bại. Vui lòng thử lại.';
        formMessage.style.color = 'red';
    }
});


// --- HÀM LẤY VÀ HIỂN THỊ HÀNG CHỜ ---
async function fetchQueue() {
    queueList.innerHTML = '<li>Đang tải danh sách chờ...</li>';

    try {
        const response = await fetch(API_URL, { method: 'GET', mode: 'cors' });
        let bookings = await response.json();

        // Lọc những booking đã được duyệt và trong tương lai
        const now = new Date();
        let upcomingBookings = bookings
            .filter(b => b.status === 'approved' && new Date(b.startTime) > now)
            .sort((a, b) => new Date(a.startTime) - new Date(b.startTime)); // Sắp xếp theo thời gian bắt đầu

        renderQueue(upcomingBookings);
        calculateMyTurn(upcomingBookings);

    } catch (error) {
        console.error('Error fetching queue:', error);
        queueList.innerHTML = '<li>Không thể tải được danh sách.</li>';
    }
}

// --- HÀM HIỂN THỊ DANH SÁCH LÊN GIAO DIỆN ---
function renderQueue(bookings) {
    queueList.innerHTML = ''; // Xóa danh sách cũ
    if (bookings.length === 0) {
        queueList.innerHTML = '<li>Chưa có ai trong hàng chờ. Hãy là người đầu tiên!</li>';
        return;
    }
    bookings.forEach(booking => {
        const li = document.createElement('li');
        const startTime = new Date(booking.startTime);
        li.textContent = `Gamer: ${booking.nickname} - Bắt đầu lúc: ${startTime.toLocaleString('vi-VN')} - Thời lượng: ${booking.duration} giờ`;
        queueList.appendChild(li);
    });
}

// --- HÀM TÍNH TOÁN VÀ HIỂN THỊ THỜI GIAN CHỜ ---
function calculateMyTurn(bookings) {
    const myNickname = localStorage.getItem('myNickname');
    if (!myNickname) {
        myTurnMessage.textContent = '';
        return;
    }

    let myBookingIndex = -1;
    for(let i = 0; i < bookings.length; i++) {
        if (bookings[i].nickname.toLowerCase() === myNickname.toLowerCase()) {
            myBookingIndex = i;
            break;
        }
    }
    
    if (myBookingIndex === -1) {
        myTurnMessage.textContent = 'Bạn chưa có lượt đặt nào trong tương lai.';
        return;
    }
    
    if (myBookingIndex === 0) {
         myTurnMessage.textContent = 'Sắp đến lượt bạn rồi!';
         return;
    }

    let waitTimeMs = 0;
    // Tính tổng thời gian của những người phía trước
    for(let i = 0; i < myBookingIndex; i++) {
        waitTimeMs += bookings[i].duration * 60 * 60 * 1000; // duration tính bằng giờ -> mili giây
    }
    
    // Thời gian chờ là từ bây giờ cho đến lúc người ngay trước mình chơi xong
    const personBeforeMe = bookings[myBookingIndex - 1];
    const personBeforeMeEndTime = new Date(new Date(personBeforeMe.startTime).getTime() + personBeforeMe.duration * 360 * 1000);
    const timeUntilMyTurn = new Date(bookings[myBookingIndex].startTime) - new Date();


    // Hiển thị countdown
    startCountdown(timeUntilMyTurn);
}

// --- HÀM ĐẾM NGƯỢC ---
let countdownInterval;
function startCountdown(duration) {
    clearInterval(countdownInterval); // Xóa bộ đếm cũ nếu có

    let timer = duration;

    countdownInterval = setInterval(() => {
        if (timer <= 0) {
            clearInterval(countdownInterval);
            myTurnMessage.textContent = "Đã đến lượt của bạn!";
            return;
        }

        timer -= 1000;

        let days = Math.floor(timer / (1000 * 60 * 60 * 24));
        let hours = Math.floor((timer % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        let minutes = Math.floor((timer % (1000 * 60 * 60)) / (1000 * 60));
        let seconds = Math.floor((timer % (1000 * 60)) / 1000);

        myTurnMessage.textContent = `Thời gian chờ dự kiến tới lượt bạn: ${days} ngày ${hours} giờ ${minutes} phút ${seconds} giây.`;

    }, 1000);
}


// --- HÀM CẬP NHẬT ĐỒNG HỒ VÀ TẢI DỮ LIỆU ---
function initialize() {
    // Cập nhật đồng hồ thời gian thực
    setInterval(() => {
        currentTimeSpan.textContent = new Date().toLocaleString('vi-VN');
    }, 1000);
    
    // Tải danh sách chờ lần đầu tiên
    fetchQueue();
    // Tự động tải lại danh sách mỗi 1 phút để cập nhật
    setInterval(fetchQueue, 60000);
}

// Khởi chạy mọi thứ
initialize();
